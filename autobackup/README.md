# Autobackup → Google Drive

Copia periódica de grabaciones (`.mp4` ya cerrados) a Google Drive con [rclone](https://rclone.org/).  
Usa `rclone copy` (no `sync`): lo subido permanece en Drive aunque el backend borre locales por `retentionDays`.

- Remoto rclone: **`camerakontrol`** (nombre de la sección en `config/rclone.conf`)
- Carpeta en Drive: **`CameraKontrol/recordings/{cameraId}/{YYYY-MM-DD}/…`**

## Requisitos

- Docker / Docker Compose
- Cuenta de Google Drive
- El mismo volumen de grabaciones que usa el servicio `backend`
- `autobackup/config/rclone.conf` con sección `[camerakontrol]` y `token` válido

## Configuración OAuth (una vez)

### Opción A — en un PC con navegador (recomendado)

1. Instala [rclone](https://rclone.org/downloads/) en Windows o Linux.
2. Ejecuta:

```bash
rclone config
```

   - `n` → nuevo remoto  
   - nombre: **`camerakontrol`** (debe coincidir con `REMOTE_PATH`)  
   - Storage: **Google Drive**  
   - `client_id` / `client_secret`: Enter (defaults de rclone) o los tuyos de Google Cloud  
   - scope: normalmente `1` (acceso completo a Drive)  
   - Autoriza en el navegador cuando lo pida  

3. Copia el conf generado a este repo:

```bash
# Windows (ruta típica)
copy %APPDATA%\rclone\rclone.conf autobackup\config\rclone.conf

# Linux
cp ~/.config/rclone/rclone.conf autobackup/config/rclone.conf
```

4. Comprueba que existe la sección **`[camerakontrol]`** y un `token = {...}`.

### Opción B — servidor Ubuntu headless

En un PC con navegador:

```bash
rclone authorize "drive"
```

Pega el JSON resultante en el `rclone.conf` del servidor (o completa el remoto con ese token).  
Copia `autobackup/config/rclone.conf` al servidor (permisos solo para tu usuario).

### Plantilla

Si partes de cero:

```bash
mkdir -p autobackup/config
cp autobackup/rclone.conf.example autobackup/config/rclone.conf
# luego rclone config editando ese fichero, o genera uno completo y sustitúyelo
```

**No subas `config/rclone.conf` a git** (está en `.gitignore`). Contiene `client_secret` y tokens OAuth.

## Arranque con Docker Compose

Desde la raíz del repo:

```bash
docker compose up -d --build autobackup
docker compose logs -f autobackup
```

En Ubuntu, el override debe montar **la misma** carpeta host de grabaciones en `backend` y `autobackup` (ver `docker-compose.override.example.yml`).

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `BACKUP_INTERVAL` | `4h` | Espera entre copias (`4h`, `30m`, `90s` o segundos) |
| `SOURCE_PATH` | `/data/recordings` | Ruta dentro del contenedor (volumen RO) |
| `REMOTE_PATH` / `BACKUP_REMOTE_PATH` | `camerakontrol:CameraKontrol/recordings` | Destino: `nombreRemoto:rutaEnDrive` |
| `MIN_AGE` / `BACKUP_MIN_AGE` | `90m` | Solo ficheros sin modificar desde hace al menos este tiempo (evita MP4 abiertos) |
| `INCLUDE` | `**/*.mp4` | Filtro rclone |
| `RUN_ONCE` | `0` | `1` = una sola pasada y sale (útil con el `.bat`) |
| `RCLONE_CONFIG` | `/config/rclone.conf` | Ruta al conf (el volumen `config` debe ser RW para renovar el token) |
| `RCLONE_TRANSFERS` | `4` | Parallelismo de subida |
| `RCLONE_CHECKERS` | `8` | Checkers rclone |
| `RCLONE_FLAGS` | _(vacío)_ | Flags extra, ej. `--dry-run` |

Puedes definirlas en `docker-compose.yml` o en el `.env` de la raíz.

Si renombras el remoto en `rclone.conf`, actualiza también `BACKUP_REMOTE_PATH` (ej. `miRemoto:CameraKontrol/recordings`).

## Una pasada (prueba)

```bash
# Linux / macOS
docker compose run --rm -e RUN_ONCE=1 autobackup

# Windows
autobackup\run-backup.bat
```

## Windows (desarrollo)

El `docker-compose.yml` monta `C:\_Developments\recordings` (igual que el backend).  
Tras tener `autobackup/config/rclone.conf`:

- `autobackup\run-backup.bat` — una copia y sale  
- `autobackup\run-backup.bat loop` — servicio en segundo plano (`up -d`)

Puedes autorizar OAuth en Windows y copiar el mismo `rclone.conf` al Ubuntu de producción.

## Cambiar de nube más adelante

El diseño solo depende del remoto en `rclone.conf` y de `REMOTE_PATH`.  
Backblaze B2, Cloudflare R2 u OneDrive se configuran como otro remoto rclone y se apunta `REMOTE_PATH` a ese nombre (p. ej. `b2:mi-bucket/recordings`).

## Notas

- No se borran archivos en Drive automáticamente.
- Si `MIN_AGE` es menor que la duración de un fragmento de grabación, sube el valor (p. ej. más de la duración del fragmento).
- Revisa cuota de Google Drive si el histórico crece mucho.
