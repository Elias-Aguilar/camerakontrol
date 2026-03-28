# Despliegue en producción (PC Windows en LAN, BD remota)

Guía para usar un **PC con Windows 10 Pro** en tu red local como servidor de **frontend y backend**, con la **base de datos PostgreSQL en otro sitio** (otro PC de la LAN o AWS). Ese PC se asume **sin herramientas de desarrollo** previas; solo instalarás runtime y utilidades necesarias.

---

## 1. Decidir dónde está PostgreSQL

### 1.A Base de datos en otro PC de tu LAN

En la máquina donde corre Postgres:

1. **Escuchar en la red**  
   En `postgresql.conf` (ubicación típica en instalaciones Windows: carpeta `data` de Postgres):
   - `listen_addresses = '*'`  
   o al menos la IP de esa máquina en la LAN.

2. **Permitir conexiones desde tu PC de producción**  
   En `pg_hba.conf`, añade una línea para la subred LAN (ajusta la máscara a tu red), por ejemplo:
   - `host  all  all  192.168.1.0/24  scram-sha-256`  
   (o `md5` según la versión y método de auth que uses.)

3. **Reiniciar** el servicio PostgreSQL en esa máquina.

4. **Firewall de Windows** (o el de ese PC): abrir el puerto **5432** (TCP) entrante solo desde IPs confiables (idealmente solo la IP del PC de producción o tu subred).

5. **Usuario y base**  
   Crea un usuario con contraseña y una base dedicada (p. ej. `camerakontrol`), o usa las credenciales que ya tengas.

Tu `DATABASE_URL` tendrá la forma:

```text
postgresql://USUARIO:CONTRASEÑA@IP_DEL_PC_POSTGRES:5432/NOMBRE_BD
```

Ejemplo: `postgresql://camerakontrol:TuClaveSegura@192.168.1.50:5432/camerakontrol`

**Seguridad:** en LAN, evita contraseñas débiles; si el PC de BD es accesible por WiFi de invitados, acota `pg_hba.conf` y el firewall.

### 1.B Base de datos en AWS (RDS PostgreSQL u otro servicio gestionado)

1. Crea una instancia **RDS for PostgreSQL** (o Aurora PostgreSQL compatible).
2. Anota el **endpoint** (hostname), puerto (suele ser **5432**), usuario administrador y contraseña.
3. **Security group de RDS:** regla entrante **PostgreSQL (5432)** solo desde:
   - la **IP pública** de tu router (si expones el PC de producción detrás de NAT y RDS acepta esa IP), o  
   - mejor: **VPN** (Client VPN, Site-to-Site) o **bastion** para no abrir 5432 a Internet sin filtro.

Si tu casa/oficina tiene IP dinámica, abrir 5432 a “todo el mundo” es arriesgado; prioriza VPN o lista de IPs actualizada.

Tu `DATABASE_URL`:

```text
postgresql://USUARIO:CONTRASEÑA@TU-INSTANCIA.xxxxx.region.rds.amazonaws.com:5432/NOMBRE_BD
```

En RDS suele exigirse **SSL**. Prisma/Node suelen aceptar parámetros en la URL, por ejemplo:

```text
postgresql://USER:PASS@endpoint:5432/camerakontrol?sslmode=require
```

(Ajusta según la documentación de tu versión de Postgres y certificados.)

---

## 2. Qué instalar en el PC de producción (Windows 10 Pro)

Instala **solo** lo necesario para ejecutar binarios ya compilados (no hace falta Visual Studio ni Docker si no quieres usarlos).

| Componente | Para qué |
|------------|----------|
| **Node.js LTS** (64-bit) | Ejecutar el backend compilado y, si sirves el front con Node, servir el `dist`. Incluye `npm`. Descarga: [https://nodejs.org](https://nodejs.org) |
| **FFmpeg** | Obligatorio para las **grabaciones** RTSP→MP4. Descarga build para Windows, descomprime y añade la carpeta `bin` al **PATH** del sistema. Comprueba en CMD: `ffmpeg -version`. |
| **Git** (opcional) | Solo si vas a clonar el repo en el servidor; si copias un ZIP con el proyecto, no es imprescindible. |

**Opcional:** **PM2** (`npm install -g pm2`) para mantener procesos Node vivos y arranque con el sistema (ver sección 5).

No necesitas PostgreSQL en el PC de producción si la BD está en otro sitio.

---

## 3. Llevar el código al PC limpio

Opciones:

- Clonar el repositorio con Git, o  
- Copiar una carpeta con el proyecto desde tu PC de desarrollo.

En el PC de producción necesitas al menos las carpetas **`backend`** y **`frontend`** con su código fuente **o** artefactos ya construidos (ver siguiente sección). Lo más simple en un PC sin dev es **construir en tu máquina de desarrollo** y copiar solo lo necesario (ver 4.C “solo artefactos”).

---

## 4. Configurar y arrancar backend y frontend

### 4.1 Backend

Abre **CMD** o **PowerShell** como usuario normal (o como administrador solo si instalas cosas globales).

```cmd
cd C:\ruta\camerakontrol\backend
npm ci
```

Si `npm ci` falla por no tener `package-lock.json`, usa `npm install`.

Crea **`backend\.env`** (ajusta valores reales):

```env
PORT=4000
DATABASE_URL="postgresql://USUARIO:CLAVE@HOST_BD:5432/camerakontrol"
RECORDINGS_PATH=C:\datos\camerakontrol\recordings
FFMPEG_PATH=ffmpeg
```

- `HOST_BD`: IP del PC con Postgres en la LAN, o endpoint RDS.
- `RECORDINGS_PATH`: carpeta donde guardar vídeos (créala antes); el usuario que ejecute el backend debe tener permisos de escritura.

Aplica el esquema en la BD remota (desde el PC de producción, con red hasta Postgres):

```cmd
npx prisma migrate deploy
```

Compila y prueba:

```cmd
npm run build
node dist\index.js
```

Comprueba en el navegador o con `curl`: `http://localhost:4000/health`.

### 4.2 Frontend

En desarrollo el front usa `VITE_API_BASE`. En **producción**, Vite “hornea” esa URL en el build: debes construir el frontend **indicando la URL que usarán los navegadores** para llamar al API.

Ejemplos:

- Si los usuarios abren el front en `http://192.168.1.100:4173` y el API en `http://192.168.1.100:4000`:
  - Antes de `npm run build`, en `frontend\.env` o variables de entorno:
  - `VITE_API_BASE=http://192.168.1.100:4000`

En el PC de producción (o en tu PC de desarrollo antes de copiar `dist`):

```cmd
cd C:\ruta\camerakontrol\frontend
npm ci
npm run build
```

Salida en **`frontend\dist`**. Esa carpeta es estática (HTML/JS/CSS).

### 4.3 Servir el frontend en producción

Opciones sencillas:

1. **`serve` (npm)**  
   ```cmd
   npm install -g serve
   serve -s C:\ruta\camerakontrol\frontend\dist -l 4173
   ```  
   Los usuarios entrarían a `http://IP_DEL_PC:4173`.

2. **IIS** (Windows): sitio web apuntando a la carpeta `dist` con fallback a `index.html` para SPA (URL rewrite).

3. **nginx para Windows** (si prefieres): raíz = `dist`, `try_files` para SPA.

El backend debe ser accesible desde los navegadores en la URL que pusiste en `VITE_API_BASE` (misma máquina con otros puertos, o proxy reverso en 80/443).

### 4.4 Firewall del PC de producción

Permite entrante **TCP** al menos en:

- Puerto del **API** (ej. **4000**).
- Puerto del **front** (ej. **4173** o **80** si usas IIS/nginx).

Restringe si puedes a la subred LAN.

---

## 5. Inicio automático con Windows (arranque del SO)

Necesitas **dos procesos** estables: backend (`node dist\index.js`) y el servidor del front (`serve` o equivalente).

### Opción A — PM2 (recomendada si usas Node para ambos)

1. Instalar PM2 global:  
   `npm install -g pm2`

2. Iniciar procesos (ajusta rutas):
   ```cmd
   cd C:\ruta\camerakontrol\backend
   pm2 start dist\index.js --name camerakontrol-api
   pm2 serve C:\ruta\camerakontrol\frontend\dist 4173 --name camerakontrol-web --spa
   ```
   (Si `pm2 serve` no está en tu versión de PM2, usa en su lugar un `ecosystem.config.cjs` con `script: "npx"` y `args: "serve -s ..."` o el binario `serve`.)

3. Guardar lista y registrar arranque:
   ```cmd
   pm2 save
   pm2-startup install
   ```
   Sigue las instrucciones que PM2 muestre (en Windows suele pedir ejecutar un comando **como administrador**; si `pm2-startup` no está disponible, revisa la documentación actual de PM2 para Windows o usa la opción B/C).

Tras reiniciar Windows, PM2 debería volver a levantar los procesos guardados.

**Nota:** Si tu versión de PM2 no incluye `pm2 serve`, instala `serve` global (`npm install -g serve`) y arranca con  
`pm2 start "C:\Program Files\nodejs\npx.cmd" --name camerakontrol-web -- serve -s C:\ruta\frontend\dist -l 4173`  
(ajusta rutas; prueba antes en consola).

### Opción B — Programador de tareas (Task Scheduler)

1. Crea dos tareas “Al iniciar sesión” o “Al arrancar el equipo” (con usuario que tenga permisos sobre carpetas y red).
2. Acción: **Iniciar programa**
   - Tarea 1: `C:\Program Files\nodejs\node.exe`  
     Argumentos: `C:\ruta\camerakontrol\backend\dist\index.js`  
     “Iniciar en”: `C:\ruta\camerakontrol\backend`
   - Tarea 2: ruta completa a `serve.cmd` o `npx.cmd` con argumentos `serve -s ... -l 4173` (o `node` + script propio).

Marca “Ejecutar con privilegios más altos” solo si hace falta (normalmente no).

### Opción C — NSSM (Non-Sucking Service Manager)

Convierte cada proceso en un **servicio de Windows** que se inicia al arrancar el SO. Útil si no quieres depender de PM2. Descarga NSSM, registra dos servicios apuntando a `node.exe` con los argumentos adecuados y directorio de trabajo `backend`.

---

## 6. Comprobaciones finales

1. Desde otro equipo de la LAN: `http://IP_PC_PRODUCCION:PUERTO_FRONT` → debe cargar la app.
2. Login / lista de cámaras: las peticiones deben ir a `VITE_API_BASE` (misma IP o nombre, puerto del API).
3. `GET http://IP:4000/health` responde OK.
4. Grabación: una cámara de prueba, ventana horaria activa, y comprobar que en `RECORDINGS_PATH` aparecen archivos y en la UI “Grabaciones”.

---

## 7. Resumen de responsabilidades

| Dónde | Qué |
|-------|-----|
| PC producción (LAN) | Node, FFmpeg, backend compilado, archivos estáticos del front, firewall local, arranque automático |
| PC/Servicio BD | Postgres accesible por red, usuarios, backups, `pg_hba` / security groups |
| Red | IPs fijas o DHCP reservado recomendado para el PC de producción y, si aplica, para el PC de BD |

Si más adelante quieres **HTTPS** en la LAN, puedes poner **nginx** o IIS como proxy con certificado (interno o Let’s Encrypt con DNS). Eso ya es un paso adicional sobre esta guía.

---

## 8. Alternativa: Docker solo para app (BD externa)

Si prefieres no instalar Node en el PC limpio pero sí **Docker Desktop**:

- No levantes el servicio `db` del `docker-compose.yml` del proyecto.
- Define `DATABASE_URL` apuntando a tu Postgres remoto (LAN o AWS) en el `environment` del servicio `backend` o mediante un archivo `.env` usado por Compose.
- Ajusta `VITE_API_BASE` para el build del frontend como antes (puede ser un paso de build en otra máquina y copiar la imagen o el `dist`).

Esta variante reduce diferencias de entorno pero exige licencia/instalación de Docker en Windows.
