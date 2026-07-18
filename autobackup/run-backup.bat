@echo off
setlocal
cd /d "%~dp0.."

if not exist "autobackup\config\rclone.conf" (
  echo Falta autobackup\config\rclone.conf
  echo Copia rclone.conf.example y completa el OAuth. Ver autobackup\README.md
  exit /b 1
)

if /i "%~1"=="loop" (
  echo Arrancando autobackup en segundo plano ^(intervalo BACKUP_INTERVAL^)...
  docker compose up -d --build autobackup
  if errorlevel 1 exit /b 1
  echo Logs: docker compose logs -f autobackup
  exit /b 0
)

echo Ejecutando una pasada de backup ^(RUN_ONCE=1^)...
docker compose run --build --rm -e RUN_ONCE=1 autobackup
exit /b %ERRORLEVEL%
