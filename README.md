## CameraKontrol

Backend (Node/Express + Prisma + Postgres) y frontend (React + Vite) orquestados con Docker Desktop para gestionar y visualizar cámaras IP.

### Requisitos

- Docker Desktop
- (Opcional) Node 20+ y npm si quieres ejecutar localmente sin Docker

### Levantar todo con Docker

En la raíz del proyecto:

```bash
docker compose build
docker compose up
```

Servicios:

- Base de datos Postgres: `localhost:5433`
- Backend API: `http://localhost:4001`
- Frontend React: `http://localhost:5173`

### Levantar solo DB con Docker

En la raíz del proyecto:

```bash
docker compose up -d db
```
Servicios:

- Base de datos Postgres: `localhost:5433`

### Backend

- Ruta de salud: `GET /health`
- Lista de cámaras: `GET /cameras`
- Crear cámara manualmente: `POST /cameras`
- Descubrir cámaras ONVIF en la red (simulado por ahora): `GET /cameras/discover`
- Grabaciones: `GET /recordings?cameraId=&date=&startTime=&endTime=`
- Reproducir grabación: `GET /recordings/:id/stream`
- Descargar grabación: `GET /recordings/:id/download`

Esquema Prisma en `backend/prisma/schema.prisma`. Para trabajar **fuera de Docker**:

```bash
cd backend
npm install
# crea un archivo .env en backend con:
# PORT=4001
# DATABASE_URL="postgresql://<usuario>:<password>@localhost:5433/camerakontrol"
# RECORDINGS_PATH=./recordings   (opcional)
# RECORDING_CRF=28               (calidad H.264, mayor = archivos más pequeños)
# RECORDING_PRESET=fast          (ultrafast|fast|medium)
# RECORDING_SCALE=720            (altura en px, 0=sin escalar)
# RECORDING_FPS=15               (0=source)
#
# por ejemplo, si usas el Postgres de Docker:
# PORT=4001
# DATABASE_URL="postgresql://camerakontrol:camerakontrol@localhost:5433/camerakontrol"
npx prisma migrate dev
npm run dev
```

### Frontend

App React con Vite en `frontend` con estas pantallas:

- Login
- Lista de cámaras
- Grabaciones (buscador por fecha/cámara, reproductor de video)
- Agregar cámaras (búsqueda en red + formulario manual)
- Editar cámara (incluye configuración de horario de grabación)

Para ejecutar **fuera de Docker**:

```bash
cd frontend
npm install
# crea un archivo .env en frontend con:
# VITE_API_BASE="http://localhost:4001"
npm run dev
```

### Dependencias y librerías de terceros

#### Backend

- **Node.js / Express**  
  - Framework HTTP para exponer la API REST (`/health`, `/cameras`, etc.).

- **Prisma** (`@prisma/client`, `prisma`)  
  - ORM para modelar y acceder a la base de datos Postgres.  
  - Esquema en `backend/prisma/schema.prisma` (modelo `Camera` con IP, puerto, credenciales, RTSP, estado, etc.).

- **PostgreSQL**  
  - Motor de base de datos relacional donde se almacenan cámaras y su configuración.  
  - En Docker se levanta como servicio `db`.

- **CORS** (`cors`)  
  - Middleware para permitir que el frontend (en otro puerto) consuma la API del backend sin problemas de cross‑origin.

- **dotenv**  
  - Carga variables de entorno desde `.env` (por ejemplo `PORT`, `DATABASE_URL`, `FFMPEG_PATH`).

- **onvif**  
  - Librería Node para realizar *discovery* ONVIF en la red local (`/cameras/discover`).

- **FFmpeg** (binario externo, más `fluent-ffmpeg` si se usa)  
  - Herramienta de línea de comandos instalada en el sistema.  
  - Se usa para conectarse al flujo RTSP de la cámara y generar imágenes (snapshots) que el navegador sí puede mostrar.

#### Frontend

- **React**  
  - Librería principal para construir la UI de la aplicación (pantallas de login, lista, vista en vivo, agregar cámaras).

- **React Router DOM**  
  - Manejo de rutas en el lado del cliente (`/login`, `/cameras`, `/live`, `/cameras/add`).

- **Vite**  
  - Herramienta de *bundling* y dev server para el proyecto React; ofrece recarga rápida durante el desarrollo.

#### Infraestructura / Herramientas

- **Docker / Docker Compose**  
  - Orquestación de servicios:
    - `db` (Postgres)
    - `backend` (API Node/Express)
    - `frontend` (React/Vite)
  - Permite levantar todo el stack con `docker compose up`.

- **Nodemon + ts-node + TypeScript**  
  - `TypeScript`: tipado estático en el backend.  
  - `ts-node`: ejecuta directamente archivos `.ts` sin compilar manualmente.  
  - `nodemon`: recarga el backend automáticamente al cambiar código fuente.

### Grabación de video

La app graba el flujo RTSP de cada cámara en archivos MP4 reproducibles, según un horario configurado por cámara.

- **Configuración por cámara** (en Editar cámara):
  - Activar grabación
  - Hora inicio (ej. 08:00)
  - Hora fin (ej. 18:00)
- **Servicio de grabación**: corre en segundo plano, revisa cada 30 s si alguna cámara debe grabar. Si la hora actual está dentro de [inicio, fin], inicia FFmpeg para capturar RTSP a MP4.

- **Almacenamiento**: `recordings/{cameraId}/{YYYY-MM-DD}/` (o `RECORDINGS_PATH` en `.env`).

- **Pantalla Grabaciones**: filtros por fecha y cámara, reproductor HTML5 y descarga.

- **FFmpeg**: debe estar instalado. Usa `-c copy` para menor uso de CPU. El backend aún ofrece:
  - `GET /cameras/:id/snapshot`  
    - Ejecuta FFmpeg contra el RTSP de la cámara.  
    - Genera un solo frame JPEG reescalado (≈480 px de ancho, calidad reducida) y lo devuelve como `image/jpeg`.
  - `GET /cameras/:id/stream`  
    - Convierte RTSP → MJPEG continuo (no se usa actualmente en la UI, pero está disponible).

En el **frontend**, la pantalla de “Vista en vivo”:

- Llama inicialmente a `GET /cameras` y decide qué cámaras mostrar:
  - Si hay cámaras seleccionadas (`isSelected = true`) muestra hasta 4 de ellas.
  - Si no hay seleccionadas, muestra hasta 4 cámaras marcadas como `isOnline = true`.
- Para cada cámara:
  - Pide `GET /cameras/:id/snapshot?ts=<tick>` cada cierto intervalo (pseudo‑vídeo basado en snapshots).
  - Muestra el último snapshot disponible en un `<img>` ocupando su celda.
- El layout de la cuadrícula se adapta según cuántas cámaras se estén mostrando:
  - 1 cámara → ocupa todo el espacio.
  - 2 cámaras → una encima de la otra.
  - 3–4 cámaras → grilla 2×2.

#### Limitaciones conocidas

- Los navegadores no soportan RTSP de forma nativa, por eso se usa FFmpeg para convertir RTSP a imágenes JPEG.
- El enfoque actual usa "pseudo‑vídeo" basado en snapshots:
  - Menos fluido que un streaming nativo (HLS/WebRTC).
  - Puede generar muchas peticiones HTTP (`/snapshot?ts=N`) y carga en CPU/red si se baja mucho el intervalo.
- FFmpeg se ejecuta en la misma máquina que el backend, por lo que:
  - Es sensible a configuración de firewall/antivirus.
  - No es la solución más escalable para muchas cámaras en paralelo.

#### Ideas para futuros pasos

- Introducir un **media server** dedicado (por ejemplo `rtsp-simple-server` / `mediamtx`) que:
  - Reciba las entradas RTSP de las cámaras.
  - Exponga salidas HLS o WebRTC que el navegador pueda reproducir de forma nativa.
- Explorar un **player WebRTC/HLS** en el frontend en lugar de snapshots.
- Para una app móvil nativa, evaluar cliente RTSP directo (sin pasar por navegador) reutilizando la configuración de cámaras y la base de datos actual.