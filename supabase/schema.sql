-- À coller dans l'éditeur SQL de ton projet Supabase (https://app.supabase.com -> SQL Editor).
-- Une seule table : une ligne par utilisateur·rice, avec les deux mêmes blobs JSON
-- que ceux gardés aujourd'hui en localStorage (board = chantier, site = tout le reste).

create table public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  board jsonb not null default '{}'::jsonb,
  site jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Un plafond par ligne : un compte ne remplit pas la base à lui seul (Selene prévient à 3 Mo et dit le refus).
  constraint app_state_taille check (octet_length(site::text) < 5000000 and octet_length(board::text) < 1000000)
);

alter table public.app_state enable row level security;

create policy "own row select" on public.app_state
  for select using (auth.uid() = user_id);

create policy "own row insert" on public.app_state
  for insert with check (auth.uid() = user_id);

create policy "own row update" on public.app_state
  for update using (auth.uid() = user_id);

-- Projet créé avant le 2 octobre 2026 : ajouter le plafond (NOT VALID : les lignes existantes ne sont pas relues ;
-- une ligne déjà plus lourde ne pourrait plus être modifiée, d'où la vérification d'abord, voir docs/compte.md).
--   select user_id, octet_length(site::text) as site, octet_length(board::text) as board from public.app_state order by 2 desc;
--   alter table public.app_state add constraint app_state_taille
--     check (octet_length(site::text) < 5000000 and octet_length(board::text) < 1000000) not valid;

-- Pas de Realtime : l'app relit la ligne toutes les 30 s et écrit par PATCH conditionnel
-- (filtre `board->>updatedAt=eq.<valeur lue>`), ce qui ne demande aucune colonne ni fonction
-- supplémentaire. Voir docs/architecture.md, « Synchronisation ».

-- Recommandé pour un cercle restreint (pas un produit public) :
-- Authentication -> Providers -> Email -> désactiver "Allow new users to sign up",
-- puis inviter chaque personne depuis Authentication -> Users -> Invite.

-- L'assistant (supabase/functions/assistant, docs/assistant.md) : la clé Anthropic de chaque compte, chiffrée par
-- la fonction (AES-GCM, secret ASSISTANT_KEY_SECRET, liée au compte). RLS activée sans aucune règle : aucun
-- navigateur ne lit ni n'écrit cette table, seule la fonction y accède avec la clé serveur du projet.
create table public.assistant_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chiffre text not null,
  iv text not null,
  indice text not null,
  updated_at timestamptz not null default now()
);

alter table public.assistant_keys enable row level security;
