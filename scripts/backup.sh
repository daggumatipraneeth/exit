#!/usr/bin/env bash
# Nightly backup: the whole database and every KYC file, copied to separate storage.
# Never deletes or overwrites anything at the destination, so a mistake (or an attacker) at the source can't erase the backup.
#
# Needs:
#   SUPABASE_DB_URL   Postgres connection string (Dashboard → Project Settings → Database → Connection string, session pooler)
#   BACKUP_PATH       destination bucket/folder, e.g. exit-backups/portal
#   rclone remotes "src" (Supabase Storage over S3) and "dst" (backup storage), set by RCLONE_CONFIG_SRC_* / RCLONE_CONFIG_DST_* env vars.
#   See PORTAL.md → Backups.
set -euo pipefail

stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "Dumping database…"
npx supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work/schema.sql"
# Data includes logins (auth) and the storage file list, so a restore needs nothing else.
# storage.buckets is left out: the migrations create the kyc bucket.
npx supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --schema public,auth,storage --exclude storage.buckets -f "$work/data.sql"

echo "Copying database dump to dst:$BACKUP_PATH/db/$stamp"
rclone copy "$work" "dst:$BACKUP_PATH/db/$stamp" --immutable

echo "Copying KYC files to dst:$BACKUP_PATH/kyc"
# New uploads always get new file names, so --immutable stops if a backed-up file ever differs instead of replacing it.
rclone copy src:kyc "dst:$BACKUP_PATH/kyc" --immutable

echo "Backup $stamp complete."
