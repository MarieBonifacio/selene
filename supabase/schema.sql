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

-- Ces règles se vérifient sur un vrai projet (de préproduction) : npm run isolation, docs/compte.md.

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

-- Le journal des erreurs (src/app/services/journal.js, docs/compte.md) : des erreurs de programmation, anonymes. Ni
-- compte, ni texte saisi : le nom de l'erreur, l'endroit du code, l'écran, la version et la plateforme. Toute page peut
-- écrire (la clé publique suffit) ; personne ne lit par l'API : on consulte dans l'éditeur SQL. Bornes : la taille de
-- chaque champ, 500 entrées par heure au plus (au-delà, l'entrée est ignorée en silence), 30 jours de conservation (la
-- politique de confidentialité le dit). Le déclencheur purge à chaque écriture : pas de tâche planifiée à entretenir.
create table public.erreurs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  version text not null check (char_length(version) between 1 and 40),
  plateforme text not null check (char_length(plateforme) between 1 and 20),
  genre text not null check (genre ~ '^[A-Za-z]{1,40}$'),
  lieu text not null default '' check (char_length(lieu) <= 200),
  vue text not null default '' check (char_length(vue) <= 40)
);
create index erreurs_at on public.erreurs (at);
alter table public.erreurs enable row level security;
create policy "journal : écriture" on public.erreurs for insert to anon, authenticated with check (true);

create function public.erreurs_borne() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.erreurs where at < now() - interval '30 days';
  if (select count(*) from public.erreurs where at > now() - interval '1 hour') >= 500 then return null; end if;
  new.at := now(); -- l'heure du serveur, pas celle que la page aurait envoyée
  return new;
end $$;
revoke all on function public.erreurs_borne() from public, anon, authenticated;
create trigger erreurs_borne before insert on public.erreurs for each row execute function public.erreurs_borne();
