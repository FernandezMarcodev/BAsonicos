# BAsónicos

Encontrador de conciertos del Gran Buenos Aires: reúne la grilla de
[agendade.com.ar](https://www.agendade.com.ar), la geolocaliza y la muestra en un mapa
interactivo con filtros por artista y por cercanía, en un diseño estilo Apple + Material.
También podés **seguir artistas** y recibir avisos cuando sumen fechas nuevas.

Reescritura del proyecto original [ExpoUno](https://github.com/FernandezMarcodev/ExpoUno):
**backend en Go** (Gin) en lugar de Flask, **frontend en TypeScript** (React + Vite) en lugar
de JavaScript, y **registro e inicio de sesión** nuevos. Los scrapers siguen siendo **Python**.

## Stack

| Capa       | Tecnología                                                        |
| ---------- | ----------------------------------------------------------------- |
| Backend    | Go 1.27, Gin, pgx (pgxpool), JWT (golang-jwt/v5), bcrypt          |
| Base       | PostgreSQL + PostGIS 16 (Docker local / **Neon** o **Supabase** en producción) |
| Scraper    | Python (requests + BeautifulSoup) + Nominatim                     |
| Frontend   | React 18 + Vite 7 + TypeScript, Tailwind CSS v4, Leaflet, react-router |
| Deploy     | Render (backend Go con scraper Python embebido en la imagen Docker + frontend estático) + PostgreSQL/PostGIS externa (Neon o Supabase) |

## Estructura

```
backend/   API en Go (rutas, servicios, auth, middleware) + docker-compose de PostGIS
scraper/   Scripts de Python que extraen la grilla y escriben a la base
frontend/  Aplicación web en React + TypeScript
```

## Puesta en marcha (desarrollo)

### 1. Base de datos

```bash
cd backend
docker compose up -d db
```

### 2. Scraper (Python)

```bash
cd scraper
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt    # Windows
# .venv/bin/pip install -r requirements.txt      # Linux/macOS
```

> El backend ejecuta el scraper automáticamente al iniciar y luego a intervalos
> (`SCRAPER_INTERVALO_MINUTOS`). También se puede correr manualmente:
> `python scraper.py scrape` o `python scraper.py mantenimiento`. En producción
> (Render) el scraper va **embebido en la imagen Docker del backend** y lo dispara
> el propio backend cada 24 h (`SCRAPER_INTERVALO_MINUTOS=1440`); no hay servicio
> Python aparte ni endpoint público de scrapeo.

### 3. Backend (Go)

```bash
cd backend
cp .env.example .env    # ajustar credenciales (PYTHON_CMD apuntando al venv)
go mod tidy
go run ./cmd/server
```

La API escucha en `http://localhost:5000`.

### 4. Frontend (TypeScript)

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:5000
npm install
npm run dev             # http://localhost:5173
```

## Endpoints

| Método | Ruta                                   | Descripción                                     |
| ------ | -------------------------------------- | ----------------------------------------------- |
| GET    | `/`                                    | Health check                                    |
| GET    | `/conciertos`                          | Lista de conciertos                             |
| POST   | `/registro`                            | `{email, nombre, password}` → `{token, usuario}`|
| POST   | `/login`                               | `{email, password}` → `{token, usuario}`        |
| GET    | `/me`                                  | Perfil del usuario (requiere `Bearer <token>`)  |
| GET    | `/favoritos`                           | Favoritos del usuario (`Bearer <token>`)        |
| POST   | `/favoritos/:conciertoId`              | Guarda un concierto como favorito               |
| DELETE | `/favoritos/:conciertoId`              | Quita un concierto de favoritos                 |
| GET    | `/seguidos`                            | Artistas seguidos (`Bearer <token>`)            |
| POST   | `/seguidos`                            | `{"artista": "..."}` → seguir (idempotente)     |
| DELETE | `/seguidos/:artista`                   | Dejar de seguir a un artista (idempotente)      |
| GET    | `/novedades`                           | Notificaciones no leídas (con el concierto)     |
| POST   | `/novedades/leer_todas`                | Marca todas las novedades como leídas           |
| POST   | `/novedades/:id/leida`                 | Marca una novedad como leída                    |

> El módulo de seguidos incluye un job que, después de cada scrape, registra
> notificaciones cuando ingresa un concierto nuevo de un artista seguido.

## Documentación

- [Cómo usar la app](COMO_USAR.md) — guía de uso completa (también disponible dentro de la
  app en `/ayuda`).
- [Arquitectura](docs/arquitectura.md) — diagramas de contexto, contenedores y componentes.
- [Base de datos](docs/base_de_datos.md) — modelos DEIR y DER (diagrama entidad-relación).
- [Requisitos](docs/requisitos.md) — especificación funcional y no funcional (IEEE 29148,
  no funcionales clasificados según Sommerville).
- [Funcionalidades futuras](FUTURAS_FEATURES.md) — roadmap documentado (chips de filtros,
  novedades por email, calendario).

## Variables de entorno

### Backend (`backend/.env`)

| Variable                  | Descripción                                        |
| ------------------------- | -------------------------------------------------- |
| `DB_HOST` / `DB_PORT`     | Host y puerto de PostgreSQL                         |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Credenciales de la base                |
| `DB_SSLMODE`              | `require` en producción (Supabase/Neon/Render)      |
| `PORT` / `HOST`           | Puerto y bind del servidor                          |
| `SCRAPER_INTERVALO_MINUTOS` | Intervalo del scrape automático (1440 en prod: cada 24 h) |
| `KEEP_ALIVE_URL`          | URL propia para keep-alive (Render)                 |
| `JWT_SECRET`              | Secreto para firmar tokens (¡cambiar en producción!)|
| `CORS_ORIGINS`            | Orígenes permitidos separados por coma (dejar vacío en dev) |
| `SITIO_WEB`               | URL pública del frontend (enlaces en push e ics)    |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Push web (generar con `go run ./cmd/generar_vapid`) |
| `PYTHON_CMD`              | Intérprete de Python con psycopg2 (apuntar al venv) |
| `SCRAPER_PATH` / `SCRAPER_RUN_DIR` | Ruta y directorio del script del scraper   |

### Frontend (`frontend/.env`)

| Variable       | Descripción                          |
| -------------- | ------------------------------------ |
| `VITE_API_URL` | URL base de la API (default local)   |
| `VITE_OSM_URL` | Plantilla de tiles OSM (default `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) |

## Deploy en Render

En producción la app se compone de **2 servicios en Render** (backend + frontend
estático) y una **base PostgreSQL con PostGIS** externa y gratuita (recomendada:
**Neon**). El scraper va **embebido en la imagen Docker del backend** y lo dispara
el propio backend cada 24 h; no hay servicio Python aparte ni endpoint público de
scrapeo. Podés aplicar el blueprint de `render.yaml` (botón **New + Blueprint**) o
crear cada servicio a mano con los datos de abajo. El backend crea las tablas y la
extensión PostGIS solas al arrancar (`db.go` es idempotente), así que la base
arranca vacía.

### 1. Base de datos (PostgreSQL + PostGIS)

**Neon** ([neon.tech](https://neon.tech)) — plan Free "para siempre" ($0/mes, sin
fecha de vencimiento): 0.5 GB de storage, 100 CU-h/mes, scale-to-zero a los 5 min de
inactividad (se reactiva solo). Es PostgreSQL real y soporta **PostGIS**; el
backend la habilita con `CREATE EXTENSION IF NOT EXISTS postgis` al arrancar.

1. Crear un proyecto en [neon.tech](https://neon.tech) (no pide tarjeta).
2. **No hace falta crear tablas ni habilitar PostGIS a mano.**
3. En **Connect** copiar el connection string **directo**:
   ```text
   postgresql://USER:PASSWORD@ep-<ref>.REGION.aws.neon.tech/dbname?sslmode=require
   ```
   y partir las credenciales: `DB_HOST` = `ep-<ref>.REGION.aws.neon.tech`,
   `DB_PORT` = `5432`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE` = `require`.

Otras bases externas gratuitas compatibles (PostgreSQL + PostGIS): **Supabase**
(pausa proyectos inactivos) o **Aiven** (una sola base free). En Supabase, usar el
DSN en **modo directo** (`db.<ref>.supabase.co:5432`) o el pooler por sesión si
Render no alcanza IPv6.

### 2. Backend (Web Service · Docker)

La imagen Go nativa de Render **no trae Python**, así que el backend se buildea
desde `backend/Dockerfile` (etapa de build Go + etapa Debian con Python 3 y el
scraper instalado en `/opt/scraper`). Los tres caminos quedan fijos en la imagen:
`PYTHON_CMD=/opt/venv/bin/python`, `SCRAPER_PATH=/opt/scraper/scraper.py`,
`SCRAPER_RUN_DIR=/opt/scraper`.

- **Type**: Web Service.
- **Source**: repositorio → **Dockerfile** (auto-detectado). Si se crea a mano,
  apuntar el **Dockerfile** a `backend/Dockerfile` y el **contexto de build** a la
  raíz del repo (la imagen necesita `backend/` y `scraper/`).
- **Root Directory**: (raíz del repo, no `backend`)
- **Health Check Path**: `/`
- **Env vars** (además de `PORT=10000` y `HOST=0.0.0.0`, ya en la imagen):
  `DB_HOST`, `DB_PORT=5432`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (de Neon),
  `DB_SSLMODE=require`, `JWT_SECRET`, `CORS_ORIGINS`,
  `SITIO_WEB=https://<frontend>.onrender.com`,
  `KEEP_ALIVE_URL=https://<backend>.onrender.com`,
  `SCRAPER_INTERVALO_MINUTOS=1440` y `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT`.
- Al arrancar corre el **mantenimiento** (pasadas + duplicados) y después el
  **scrape** cada **24 h** (`SCRAPER_INTERVALO_MINUTOS=1440`), escribiendo directo
  en Neon.

### 3. Frontend (Static Site)

- **Type**: Static Site (es un build estático, no un servidor).
- **Root Directory**: `frontend`
- **Build Command**: `npm ci && npm run build`
- **Publish Directory**: `dist`
- **Env var (build-time)**: `VITE_API_URL=https://<backend>.onrender.com`
- **SPA fallback** (Settings → Redirects/Rewrites → New Rule): `type` **rewrite**,
  `source` `/*`, `destination` `/index.html`. El blueprint `render.yaml` ya lo trae.

### 4. Despertador del backend (plan free)

El plan free de Render duerme la instancia a los ~15 min sin tráfico. Para que el
loop de 24 h del scraper se dispare, un servicio externo gratis (UptimeRobot,
cron-job.org) debe **pinguear el health check del backend cada ~10 min**: tipo
**HTTP(S)** → `https://<backend>.onrender.com/` → intervalo 5-10 min. El endpoint
`/` solo responde 200; no expone nada.

### 5. Verificación

```bash
curl https://<backend>.onrender.com/                       # health check
curl https://<backend>.onrender.com/conciertos            # array (vacío al inicio)
curl https://<frontend>.onrender.com/                     # SPA
```

La base se llena sola en el primer arranque (mantenimiento) y cada 24 h (scrape).
En los registros del backend se ve `Scrapeo completado` cuando termina bien.

### 6. Blueprint (alternativa)

Botón **New + Blueprint** → repositorio BAsonicos. Se crean los 2 servicios
(`bassonicos-backend`, `bassonicos-frontend`) con la config de `render.yaml`; los
**secretos** se llenan en el dashboard de cada servicio (`sync: false`).