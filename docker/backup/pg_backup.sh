#!/usr/bin/env bash
# =============================================================================
# WINDMAR PostgreSQL Backup Script
# =============================================================================
# Usage:
#   ./docker/backup/pg_backup.sh              # Manual run
#   crontab: 0 2 * * * /path/to/pg_backup.sh  # Daily at 2 AM
#
# Environment variables (with defaults from docker-compose.yml):
#   DB_USER, DB_PASSWORD, DB_NAME, DB_CONTAINER, BACKUP_DIR, RETENTION_DAYS
# =============================================================================

set -euo pipefail

# Configuration (override via environment)
DB_USER="${DB_USER:-windmar}"
DB_PASSWORD="${DB_PASSWORD:-windmar_dev_password}"
DB_NAME="${DB_NAME:-windmar}"
DB_CONTAINER="${DB_CONTAINER:-windmar-db}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Derived
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# Dump and compress
docker exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
    | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Prune old backups
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] Pruned $DELETED backup(s) older than $RETENTION_DAYS days"
fi

echo "[$(date)] Done. Active backups:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | tail -5
