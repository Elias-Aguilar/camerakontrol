#!/bin/sh
set -eu

CONFIG_FILE="${RCLONE_CONFIG:-/config/rclone.conf}"
SOURCE_PATH="${SOURCE_PATH:-/data/recordings}"
REMOTE_PATH="${REMOTE_PATH:-camerakontrol:CameraKontrol/recordings}"
BACKUP_INTERVAL="${BACKUP_INTERVAL:-4h}"
MIN_AGE="${MIN_AGE:-90m}"
INCLUDE="${INCLUDE:-**/*.mp4}"
RUN_ONCE="${RUN_ONCE:-0}"
RCLONE_FLAGS="${RCLONE_FLAGS:-}"

duration_to_seconds() {
  d="$1"
  case "$d" in
    *h|*H) echo $((${d%[hH]} * 3600)) ;;
    *m|*M) echo $((${d%[mM]} * 60)) ;;
    *s|*S) echo $((${d%[sS]})) ;;
    *)
      if echo "$d" | grep -Eq '^[0-9]+$'; then
        echo "$d"
      else
        echo "Intervalo no válido: $d (usa 4h, 30m, 90s o segundos)" >&2
        exit 1
      fi
      ;;
  esac
}

run_backup() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Iniciando copia: $SOURCE_PATH -> $REMOTE_PATH (min-age=$MIN_AGE, include=$INCLUDE)"
  # shellcheck disable=SC2086
  rclone copy "$SOURCE_PATH" "$REMOTE_PATH" \
    --config "$CONFIG_FILE" \
    --include "$INCLUDE" \
    --min-age "$MIN_AGE" \
    --transfers "${RCLONE_TRANSFERS:-4}" \
    --checkers "${RCLONE_CHECKERS:-8}" \
    -v \
    $RCLONE_FLAGS
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Copia finalizada"
}

if [ ! -f "$CONFIG_FILE" ]; then
  echo "No se encontró $CONFIG_FILE" >&2
  echo "Copia rclone.conf.example a config/rclone.conf y completa el OAuth (ver README.md)." >&2
  exit 1
fi

if [ ! -d "$SOURCE_PATH" ]; then
  echo "SOURCE_PATH no existe o no es un directorio: $SOURCE_PATH" >&2
  exit 1
fi

if [ "$RUN_ONCE" = "1" ]; then
  run_backup
  exit 0
fi

INTERVAL_SEC="$(duration_to_seconds "$BACKUP_INTERVAL")"
echo "autobackup activo: intervalo=${BACKUP_INTERVAL} (${INTERVAL_SEC}s), remoto=${REMOTE_PATH}"

while true; do
  if ! run_backup; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ERROR: falló la copia; se reintentará tras el intervalo" >&2
  fi
  sleep "$INTERVAL_SEC"
done
