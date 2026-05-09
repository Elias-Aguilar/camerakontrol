## CameraKontrol

Aplicación web para **gestionar cámaras IP (RTSP)**, **programar grabaciones** por ventanas horarias (hasta 3 por cámara) y **consultar o eliminar** los vídeos grabados (MP4).

- **Backend:** Node.js, Express, Prisma, PostgreSQL. Grabación con **FFmpeg** desde RTSP.
- **Frontend:** React, Vite, React Router, Bootstrap (toasts y modales de confirmación).

---

### Requisitos

- **Docker Desktop** (opción recomendada para levantar todo el stack), o bien:
- **Node.js 20+**, **npm**, **PostgreSQL 16+**, **FFmpeg** en el PATH (si ejecutas backend y frontend en tu máquina).

---

### Ejecutar con Docker

En la raíz del repositorio:

```bash
docker compose up --build
```

Servicios expuestos en el host:

| Servicio   | URL / host                    |
|-----------|-------------------------------|
| Frontend  | http://localhost:5173         |
| API       | http://localhost:4000         |
| Postgres  | `localhost:5433` (usuario/contraseña/BD: `camerakontrol`) |

El backend aplica migraciones Prisma al arrancar (`prisma migrate deploy`) y guarda las grabaciones en la ruta montada en `/app/recordings` (volumen nombrado o carpeta del host, según tu `docker-compose`).

**Frontend en Docker (producción)**

- La imagen ejecuta **`npm run build`** al construir y sirve los estáticos con **`serve`** (no usa `vite dev`). Es más estable en servidores con poca RAM y evita errores de esbuild en runtime.
- **`VITE_API_BASE`** se inyecta **en tiempo de build** (`build.args` en Compose). Debe ser la URL del API tal como la ve el navegador. Si la cambias en `.env`, vuelve a construir: `docker compose build --no-cache frontend` o `docker compose up --build`.

**Grabación programada en Docker**

- **Zona horaria:** el contenedor usa por defecto **UTC**. Los horarios de las ventanas se comparan con la hora del contenedor. Para alinearlos con tu país, define `TZ` en un `.env` en la raíz del repo (Compose lo inyecta), por ejemplo: `TZ=America/Santiago`.
- **Estado “online”:** el servicio de grabación **no exige** que la cámara esté marcada `isOnline` en base de datos (ese flag depende de un chequeo TCP que a menudo falla desde Docker aunque el RTSP sea válido). Si quieres el comportamiento antiguo: `RECORDING_REQUIRE_ONLINE=1` en el entorno del backend.
- **Depuración:** `RECORDING_DEBUG=1` escribe en logs cada ciclo (~30 s) la hora usada y cuántas cámaras tienen grabación activada.

**Solo la base de datos en Docker** (por ejemplo, para desarrollar API y UI en local):

```bash
docker compose up -d db
```

**Acceso desde otra máquina en la LAN:** el navegador debe poder llegar al API. Crea un archivo `.env` en la **raíz del repo** (junto a `docker-compose.yml`) con:

```env
VITE_API_BASE=http://TU_IP_EN_LA_RED:4000
```

Vuelve a **construir la imagen del frontend** para que el valor quede en el bundle:

```bash
docker compose build --no-cache frontend
docker compose up -d
```

(o `docker compose up --build`.)

---

### Ejecutar en local (sin contenedores de app)

#### 1. Base de datos

Levanta Postgres (puede ser el contenedor solo-DB anterior) y anota host y puerto. Ejemplo con el compose del proyecto:

```bash
docker compose up -d db
```

#### 2. Backend

```bash
cd backend
npm install
```

Crea `backend/.env`, por ejemplo:

```env
PORT=4000
DATABASE_URL="postgresql://camerakontrol:camerakontrol@localhost:5433/camerakontrol"
# Opcional:
# RECORDINGS_PATH=./recordings
# FFMPEG_PATH=ffmpeg
# RECORDING_CRF=28
# RECORDING_PRESET=fast
# RECORDING_SCALE=720
# RECORDING_FPS=15
# RECORDING_USE_COPY=1
```

Si cambias `PORT`, usa el mismo puerto en `VITE_API_BASE` del frontend (p. ej. `http://localhost:4001`).

Aplica el esquema y arranca:

```bash
npx prisma migrate deploy
npm run dev
```

Comprueba `GET http://localhost:<PORT>/health`.

#### 3. Frontend

```bash
cd frontend
npm install
```

Crea `frontend/.env` apuntando al mismo puerto que uses en el backend:

```env
VITE_API_BASE="http://localhost:4000"
```

```bash
npm run dev
```

Abre la URL que indique Vite (por defecto http://localhost:5173).

**FFmpeg** debe estar instalado y accesible en el sistema donde corre el backend; sin él no habrá grabación.

---

### Funcionalidad actual (UI)

- **Login** (flujo simulado; redirección a la lista de cámaras).
- **Lista de cámaras:** estado de conexión (comprobación TCP al puerto RTSP), editar, eliminar.
- **Agregar cámara:** descubrimiento ONVIF en red y alta manual (IP, puerto, credenciales, RTSP).
- **Editar cámara:** datos de conexión y **grabación programada**: hasta **tres franjas horarias** en formato 24 h, duración de fragmento por archivo, retención en días.
- **Grabaciones:** filtro por fecha y cámara, reproducción en el navegador, descarga y borrado (individual o múltiple).

No hay pantalla de **vista en vivo** en la aplicación web actual.

---

### API REST (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| GET | `/cameras` | Lista de cámaras |
| GET | `/cameras/discover` | Descubrimiento ONVIF |
| POST | `/cameras` | Crear cámara |
| GET | `/cameras/:id` | Detalle |
| GET | `/cameras/:id/status` | Comprobar si el host/puerto responde |
| PUT | `/cameras/:id` | Actualizar (incl. `recordingWindows`, retención, etc.) |
| DELETE | `/cameras/:id` | Eliminar cámara |
| GET | `/recordings` | Lista (`?date=YYYY-MM-DD`, `?cameraId=`, opcional `startTime` / `endTime` HH:mm) |
| GET | `/recordings/:id/stream` | Reproducir MP4 (soporta Range) |
| GET | `/recordings/:id/download` | Descargar archivo |
| DELETE | `/recordings` | Cuerpo JSON `{ "ids": [1,2,...] }` |

Existen también rutas técnicas sobre flujo RTSP (`/cameras/:id/snapshot`, `/cameras/:id/stream`) pensadas para uso puntual o integraciones; **no forman parte del flujo principal de la UI descrita arriba**.

---

### Grabación programada

- Se evalúa cada ~30 s qué cámaras tienen grabación activada, están marcadas como online y cuya hora actual cae en **alguna** de sus ventanas (`recordingWindows`, máximo 3).
- Los archivos se generan con FFmpeg (por defecto re-codificación H.264; con `RECORDING_USE_COPY=1` se puede usar copia directa si la cámara es compatible).
- Rutas de archivo típicas: `recordings/<cameraId>/<YYYY-MM-DD>/` o la ruta definida en `RECORDINGS_PATH`.
- Limpieza por **retención** según días configurados por cámara.

Esquema y migraciones: `backend/prisma/schema.prisma`.

---

### Stack principal

**Backend:** Express, Prisma, PostgreSQL, `onvif`, `dotenv`, `cors`, `fluent-ffmpeg` (donde aplique).  
**Frontend:** React 18, React Router, Vite, Bootstrap / react-bootstrap.

---

### Docker: notas

- El descubrimiento ONVIF desde el contenedor puede comportarse distinto que en el host por la red bridge de Docker; en algunos entornos conviene probar descubrimiento desde la máquina host o ajustar red/puertos.
- Las cámaras deben ser alcanzables **desde el host o contenedor donde corre el backend**, según tu despliegue.
