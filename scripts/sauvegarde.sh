#!/usr/bin/env bash
# La sauvegarde chiffrée de la base (workflow Sauvegarde ; docs/compte.md, « Sauvegarder la base » ; T4 de l'audit).
# Rôles, schéma et données, vidés par la CLI Supabase dans un dossier temporaire, puis archivés et chiffrés pour la clé
# publique age donnée : seul le fichier chiffré sort de ce dossier, effacé à la fin quoi qu'il arrive. Un schéma sans
# la table app_state fait échouer : ce n'est pas la base de Selene (mauvaise adresse ?), et une sauvegarde vide ne doit
# pas passer pour une sauvegarde.
# Usage : SUPABASE_DB_URL=… AGE_RECIPIENT=age1… scripts/sauvegarde.sh <dossier de sortie>
set -euo pipefail
out="${1:?usage : scripts/sauvegarde.sh <dossier de sortie>}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manque}" "${AGE_RECIPIENT:?AGE_RECIPIENT manque}"
case "$AGE_RECIPIENT" in
  age1*) ;;
  *) echo "AGE_RECIPIENT doit être une clé publique age (age1…), jamais la clé privée." >&2; exit 1 ;;
esac
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work/data.sql" --use-copy --data-only
if ! grep -Eq '"?public"?\."?app_state"?' "$work/schema.sql"; then
  echo "Le schéma vidé n'a pas la table public.app_state : ce n'est pas la base de Selene." >&2
  exit 1
fi
mkdir -p "$out"
file="$out/selene-base-$(date -u +%Y-%m-%dT%H%MZ).tar.gz.age"
tar -C "$work" -czf - roles.sql schema.sql data.sql | age -r "$AGE_RECIPIENT" -o "$file"
echo "$(basename "$file") : $(wc -c < "$file") octets, chiffrés"
