-- À coller dans l'éditeur SQL de ton projet Supabase (https://app.supabase.com -> SQL Editor).
-- Une seule table : une ligne par utilisateur·rice, avec les deux mêmes blobs JSON
-- que ceux gardés aujourd'hui en localStorage (board = chantier, site = tout le reste).

create table public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  board jsonb not null default '{}'::jsonb,
  site jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "own row select" on public.app_state
  for select using (auth.uid() = user_id);

create policy "own row insert" on public.app_state
  for insert with check (auth.uid() = user_id);

create policy "own row update" on public.app_state
  for update using (auth.uid() = user_id);

-- Pas de Realtime : l'app relit la ligne toutes les 30 s et écrit par PATCH conditionnel
-- (filtre `board->>updatedAt=eq.<valeur lue>`), ce qui ne demande aucune colonne ni fonction
-- supplémentaire. Voir docs/architecture.md, « Synchronisation ».

-- Recommandé pour un cercle restreint (pas un produit public) :
-- Authentication -> Providers -> Email -> désactiver "Allow new users to sign up",
-- puis inviter chaque personne depuis Authentication -> Users -> Invite.
