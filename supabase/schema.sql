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

-- La mesure d'usage de la bêta (services/activite.js, docs/compte.md ; E4 de l'audit) : une ligne par compte et par
-- jour où il a saisi quelque chose, rien d'autre. Écrite avec la session, pour soi seulement ; jamais relue par l'API.
-- Le déclencheur impose le compte de la session, refuse un jour qui n'est pas aujourd'hui (à un jour près, pour les
-- fuseaux), ignore en silence un doublon et efface ce qui a plus de 90 jours. Supprimer le compte efface ses lignes.
create table public.activite (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  jour date not null,
  primary key (user_id, jour)
);
alter table public.activite enable row level security;
create policy "activité : pour soi" on public.activite for insert to authenticated with check (user_id = auth.uid());

create function public.activite_borne() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.activite where jour < current_date - 90;
  new.user_id := auth.uid();
  if new.user_id is null or new.jour not between current_date - 1 and current_date + 1 then return null; end if;
  if exists (select 1 from public.activite where user_id = new.user_id and jour = new.jour) then return null; end if;
  return new;
end $$;
revoke all on function public.activite_borne() from public, anon, authenticated;
create trigger activite_borne before insert on public.activite for each row execute function public.activite_borne();

-- La page publique de test (essai.html, docs/essai.md ; E3 de l'audit). Deux tables que la page peut seulement écrire,
-- avec la clé publique ; on les lit dans l'éditeur SQL. Pas de compte, pas de cookie, rien d'écrit sur l'appareil.
--
-- La liste d'attente : une adresse pour prévenir de l'ouverture de la bêta, le lien d'arrivée (?src=…) et, si la
-- personne le dit, sur quoi elle travaille. Le déclencheur met l'adresse en minuscules, ignore en silence une adresse
-- déjà inscrite (la page ne peut donc pas servir à savoir qui l'est) et toute inscription au-delà de 200 par heure,
-- impose l'heure du serveur, et efface ce qui a plus de deux ans (la politique de confidentialité le dit).
create table public.attente (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  email text not null unique check (char_length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  source text not null default '' check (source ~ '^[a-z0-9-]{0,30}$'),
  projet text not null default '' check (projet in ('', 'these', 'livre', 'articles', 'autre'))
);
create index attente_at on public.attente (at);
alter table public.attente enable row level security;
create policy "liste d'attente : inscription" on public.attente for insert to anon, authenticated with check (true);

create function public.attente_borne() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.attente where at < now() - interval '2 years';
  new.email := lower(btrim(new.email));
  new.at := now();
  if exists (select 1 from public.attente where email = new.email) then return null; end if;
  if (select count(*) from public.attente where at > now() - interval '1 hour') >= 200 then return null; end if;
  return new;
end $$;
revoke all on function public.attente_borne() from public, anon, authenticated;
create trigger attente_borne before insert on public.attente for each row execute function public.attente_borne();

-- La mesure d'audience : une ligne par ouverture de la page (pas les rechargements) ou par clic sur « Essayer », avec
-- la date, la page et le lien d'arrivée. Ni adresse IP, ni identifiant : on compte des ouvertures, pas des personnes.
-- Au plus 2 000 lignes par heure, gardées 13 mois.
create table public.audience (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  page text not null check (page ~ '^[a-z0-9-]{1,20}$'),
  evenement text not null check (evenement in ('visite', 'essai')),
  source text not null default '' check (source ~ '^[a-z0-9-]{0,30}$')
);
create index audience_at on public.audience (at);
alter table public.audience enable row level security;
create policy "audience : écriture" on public.audience for insert to anon, authenticated with check (true);

create function public.audience_borne() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.audience where at < now() - interval '13 months';
  if (select count(*) from public.audience where at > now() - interval '1 hour') >= 2000 then return null; end if;
  new.at := now();
  return new;
end $$;
revoke all on function public.audience_borne() from public, anon, authenticated;
create trigger audience_borne before insert on public.audience for each row execute function public.audience_borne();
