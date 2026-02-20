#!/usr/bin/env bash
# Generate a demo database snapshot from a running dev instance.
#
# Dumps only the LATEST forecast run per source (gfs, cmems_wave,
# cmems_current, cmems_ice) to keep the snapshot small (~100-200 MB).
#
# Prerequisites:
#   - windmar-db container running with weather data already ingested
#
# Usage:
#   bash scripts/demo-dump.sh
#
# Output:
#   data/demo-snapshot.sql.gz

set -euo pipefail

CONTAINER="${WINDMAR_DB_CONTAINER:-windmar-db}"
DB_USER="${DB_USER:-windmar}"
DB_NAME="${DB_NAME:-windmar}"
OUTPUT="data/demo-snapshot.sql.gz"

echo "==> Identifying latest forecast run per source..."

RUN_IDS=$(docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -A -c "
  SELECT string_agg(id::text, ',')
  FROM (SELECT MAX(id) as id FROM weather_forecast_runs GROUP BY source) sub;
")

if [ -z "${RUN_IDS}" ]; then
  echo "ERROR: No forecast runs found in database."
  exit 1
fi

echo "==> Dumping runs: ${RUN_IDS}"

# Use COPY with filtered queries — writes to container /tmp, then stream out
docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "
  COPY (SELECT * FROM weather_forecast_runs WHERE id IN (${RUN_IDS})) TO '/tmp/demo_runs.copy';
"
echo "==> Forecast runs exported"

docker exec "${CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "
  COPY (SELECT * FROM weather_grid_data WHERE run_id IN (${RUN_IDS})) TO '/tmp/demo_grid.copy';
"
echo "==> Grid data exported"

echo "==> Assembling compressed snapshot..."

{
  echo "-- Demo snapshot: latest forecast run per source"
  echo "-- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "-- Runs: ${RUN_IDS}"
  echo ""
  echo "COPY weather_forecast_runs FROM stdin;"
  docker exec "${CONTAINER}" cat /tmp/demo_runs.copy
  echo "\\."
  echo ""
  echo "COPY weather_grid_data FROM stdin;"
  docker exec "${CONTAINER}" cat /tmp/demo_grid.copy
  echo "\\."
} | gzip > "${OUTPUT}"

# Cleanup temp files in container
docker exec "${CONTAINER}" rm -f /tmp/demo_runs.copy /tmp/demo_grid.copy

SIZE=$(du -h "${OUTPUT}" | cut -f1)
echo "==> Snapshot written to ${OUTPUT} (${SIZE})"
echo "==> Use docker-compose.demo.yml to deploy."
