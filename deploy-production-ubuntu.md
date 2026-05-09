# Despliegue en Ubuntu Server (Docker)

Guía para ejecutar **CameraKontrol** en un servidor **Ubuntu Server** con **Docker** y **Docker Compose**, con una estructura de carpetas clara: **código en `repos`**, **datos (grabaciones) en `data`**.

> **Versión de Ubuntu:** Si tu instalación es **26.04** u otra LTS reciente, los pasos son equivalentes; ajusta solo si cambian nombres de paquetes.

---

## Estructura de carpetas recomendada (ejemplo de usuario `eaguilar`)

En el home del usuario (o el que uses para desplegar), por convención:

| Ruta en el servidor | Uso |
|-------------------|-----|
| `~/apps/repos/` | Clonado con **git**; aquí vive el proyecto y desde aquí ejecutas `docker compose`. |
| `~/apps/data/camerakontrol/` | **Solo datos persistidos de grabación** (MP4). El bind mount de Docker apunta aquí. |

Ejemplo de árbol:

```text
~/apps/
├── data/
│   └── camerakontrol/     # grabaciones (creada antes del primer up)
└── repos/
    └── camerakontrol/     # repositorio git, contiene docker-compose.yml
```

Puedes usar otra ruta base distinta de `~/apps`; lo importante es **separar** `repos` (código) y `data` (vídeos).

---

## 1. ¿Es viable con ~70 GB de disco?

**Sí, es viable** como servidor dedicado a esta aplicación (API + UI + Postgres en Docker + carpeta de grabaciones), siempre que tengas claros los límites:

| Recurso | Notas |
|--------|--------|
| **Sistema + Docker** | Varias GB entre SO, imágenes y volúmenes de Postgres; suele quedar margen amplio respecto a 70 GB. |
| **Grabaciones** | Es lo que más espacio consume: depende de **resolución**, **CRF**, **horas al día que grabas**, **número de cámaras** y **retención** configurada por cámara. |
| **70 GB** | Puede ser suficiente para pocas cámaras, horarios acotados y retención en días moderada; con varias cámaras 24/7 en alta calidad el disco se llena antes. |

**Recomendaciones:**

- Configura **retención (días)** en cada cámara y revisa `df -h` periódicamente.
- Opcional: más adelante puedes montar un disco extra y mover solo `~/apps/data/camerakontrol` (o un symlink).

No hay “imágenes” separadas en disco para la app: lo pesado son los **MP4** de grabación (y el volumen de Postgres, mucho menor).

---

## 2. Rutas de grabación (host vs contenedor)

**En el servidor Linux** no uses rutas de Windows (`C:\...`). En Docker:

| Concepto | Valor habitual |
|----------|----------------|
| **Ruta dentro del contenedor** | **`/app/recordings`** (`RECORDINGS_PATH` en `docker-compose.yml`). No hace falta cambiarla. |
| **Ruta en el host Ubuntu** | En este esquema: **`~/apps/data/camerakontrol`** (ruta absoluta, p. ej. `/home/eaguilar/apps/data/camerakontrol`). |

En `docker-compose.yml`, el volumen del servicio `backend` debe quedar así (ajusta el usuario si no es `eaguilar`):

```yaml
volumes:
  - /home/eaguilar/apps/data/camerakontrol:/app/recordings
```

O, desde el mismo directorio del proyecto, puedes usar ruta relativa al **data** común (menos portable entre usuarios):

```yaml
volumes:
  - ../../data/camerakontrol:/app/recordings
```

Recomendación: usa la **ruta absoluta** con tu usuario para evitar confusiones al ejecutar `docker compose` desde otro directorio.

**Antes del primer `docker compose up`**, crea la carpeta de datos:

```bash
mkdir -p ~/apps/data/camerakontrol
chmod 755 ~/apps/data/camerakontrol
```

Si Docker escribe como `root` y luego quieres leer con tu usuario, ajusta con `chown` según tu política (o deja que el propietario sea `root` y usa `sudo` para inspeccionar).

---

## 3. Requisitos en el servidor

- **Ubuntu Server** (24.04 LTS, 26.x u otra versión estable).
- **Git** (en `~/apps/repos` clonarás el repo).
- **Docker Engine** + **Docker Compose plugin** (documentación oficial de Docker para Ubuntu).
- **Espacio en disco** y red hasta las **cámaras RTSP** (misma LAN o enrutamiento correcto).
- **Firewall** (p. ej. `ufw`): puertos del **frontend** y del **API** (5173 y 4000 por defecto en el compose del repo), según qué expongas.

---

## 4. Pasos de despliegue

### 4.1 Directorios `apps`, `data` y `repos`

```bash
mkdir -p ~/apps/data/camerakontrol
mkdir -p ~/apps/repos
cd ~/apps/repos
```

### 4.2 Clonar el repositorio

```bash
git clone <URL_DE_TU_REPO> camerakontrol
cd ~/apps/repos/camerakontrol
```

### 4.3 Rutas de grabación (`docker-compose.override.yml`)

El repo incluye **`docker-compose.override.example.yml`** (plantilla versionada). En el servidor:

```bash
cd ~/apps/repos/camerakontrol
cp docker-compose.override.example.yml docker-compose.override.yml
# Opcional: edita docker-compose.override.yml si tu usuario Linux no es eaguilar
```

El archivo **`docker-compose.override.yml`** está en **`.gitignore`**: no se sube al remoto; cada máquina tiene la suya. Compose fusiona `docker-compose.yml` + `docker-compose.override.yml`.

Contenido esperado (usuario **eaguilar**):

```yaml
services:
  backend:
    volumes:
      - /home/eaguilar/apps/data/camerakontrol:/app/recordings
```

Alternativa: editar a mano el volumen del **backend** en `docker-compose.yml` solo en el servidor (menos recomendable si sincronizas el repo con Windows).

### 4.4 Variables de entorno en la raíz del proyecto

En `~/apps/repos/camerakontrol/.env` (junto a `docker-compose.yml`):

```env
# URL que el navegador usará para llamar al API (IP del servidor en tu LAN)
VITE_API_BASE=http://192.168.x.x:4000

# Zona horaria para horarios de grabación
TZ=America/Argentina/Buenos_Aires
```

Si cambias `VITE_API_BASE`, reconstruye la imagen del frontend (el valor va **compilado** en el bundle): `docker compose build --no-cache frontend && docker compose up -d` o `docker compose up --build`.

### 4.5 Levantar el stack

Desde el repo:

```bash
cd ~/apps/repos/camerakontrol
docker compose up --build -d
```

Comprueba:

```bash
docker compose ps
curl -s http://127.0.0.1:4000/health
```

Desde otro equipo: `http://IP_DEL_SERVIDOR:5173` (ajusta firewall).

### 4.6 Firewall (ejemplo con UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 5173/tcp
sudo ufw allow 4000/tcp
sudo ufw enable
sudo ufw status
```

Restringe por IP/subred si puedes (`ufw allow from 192.168.1.0/24 to any port 4000`).

---

## 5. Diferencias respecto a Windows

| Tema | Windows (Docker Desktop) | Ubuntu Server |
|------|---------------------------|---------------|
| Ruta de grabaciones | `C:\...` | `~/apps/data/camerakontrol` (o la absoluta equivalente) |
| Código / compose | Carpeta del proyecto | `~/apps/repos/camerakontrol` |
| Permisos | Menos habitual `chown` | Asegura que exista `data/camerakontrol` antes del bind mount. |
| Red hacia cámaras | Similar | El servidor debe alcanzar IP:554 (RTSP). |
| Hora de grabación | `TZ` en compose | Igual: define `TZ` en `.env` raíz del proyecto. |

---

## 6. Base de datos en otro sitio

Si Postgres **no** va en el mismo `docker-compose`:

- Ajusta `DATABASE_URL` del backend al Postgres remoto.
- El directorio `~/apps/data/camerakontrol` sigue siendo solo para **archivos de vídeo**; los datos de Postgres pueden seguir en el volumen Docker `db_data` o en el servicio externo.

Detalle en `deploy-production.md` (LAN / AWS).

---

## 7. Mantenimiento y espacio

```bash
df -h
docker system df
ls -lah ~/apps/data/camerakontrol
```

Si el disco se llena: retención más corta, menos horas de grabación o más disco (y actualiza el bind mount si mueves la carpeta).

---

## 8. Resumen

| Pregunta | Respuesta corta |
|----------|-------------------|
| ¿70 GB es viable? | Sí para empezar; vigila grabaciones y retención. |
| ¿Dónde graba el disco? | En el host: **`~/apps/data/camerakontrol`** (mapeado a `/app/recordings` en el contenedor). |
| ¿Dónde está el proyecto? | **`~/apps/repos/camerakontrol`** (git + `docker compose`). |
| ¿Cambiar rutas? | Solo el **lado izquierdo** del volumen en compose; dentro del contenedor sigue `/app/recordings`. |

Con esto mantienes **repos** y **data** separados, como en tu esquema `~/apps`.
