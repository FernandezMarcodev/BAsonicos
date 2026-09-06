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
| Base       | PostgreSQL + PostGIS 16 (Docker local / **Supabase** en producción) |
| Scraper    | Python (requests + BeautifulSoup) + Nominatim                     |
| Frontend   | React 18 + Vite 7 + TypeScript, Tailwind CSS v4, Leaflet, react-router |
| Deploy     | Render: web service Go + web service Python (scraper) + static frontend |

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
> (Render) el scrapeo lo maneja un servicio Python aparte (`scraper/server.py`),
> no el backend Go.

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
| GET    | `/scrape_conciertos_agendade`          | Dispara el scraper manualmente (función pública)|
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
| `SCRAPER_INTERVALO_MINUTOS` | Intervalo del scrape automático (0 en prod: lo maneja el servicio Python) |
| `KEEP_ALIVE_URL`          | URL propia para keep-alive (Render)                 |
| `JWT_SECRET`              | Secreto para firmar tokens (¡cambiar en producción!)|
| `ADMIN_TOKEN`             | Token para el endpoint manual `/scrape_conciertos_agendade` |
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

## Deploy en Render + Supabase

La app en producción se compone de: **Supabase** (base PostgreSQL + PostGIS) y **3
servicios en Render** (backend Go, scraper Python, frontend estático). El blueprint
está en `render.yaml`; se aplica desde el dashboard de Render con **Blueprint**
seleccionando la rama `deploy/render-supabase` (cada push a esa rama re-despliega).

### 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) (gratis).
2. En **SQL Editor** habilitar PostGIS (el backend lo reinstenta, pero mejor ya):
   ```sql
   create extension if not exists postgis;
   ```
3. **No hace falta crear tablas**: el backend las crea al arrancar (`db.go` es
   idempotente: `CREATE TABLE IF NOT EXISTS` + índices).
4. En **Connect** copiar el DSN. Usá el **modo directo**
   (`db.<ref>.supabase.co:5432`). Si Render no alcanza IPv6, usar el pooler en
   modo sesión (`aws-<region>.pooler.supabase.com:5432`, usuario
   `postgres.<ref>`).

### 2. Render (Blueprint)

1. En el dashboard: **New + Blueprint** → repositorio BAsonicos → branch
   `deploy/render-supabase`.
2. Se crean 3 servicios:
   - `bassonicos-backend` (Go, free)
   - `bassonicos-scraper` (Python, free)
   - `bassonicos-frontend` (static, free)
3. En cada servicio llenar los **secretos** (`sync: false`):
   - **backend**: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
     (de Supabase), `JWT_SECRET`, `ADMIN_TOKEN`, `CORS_ORIGINS` y `SITIO_WEB`
     (URL del frontend, p. ej. `https://bassonicos-frontend.onrender.com`),
     `KEEP_ALIVE_URL` (URL pública del backend, `https://<backend>.onrender.com`),
     `VAPID_*`.
   - **scraper**: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (mismos de Supabase).
   - **frontend**: `VITE_API_URL` = URL pública del backend.

### 3. Despertador del scraper (plan free)

El plan free de Render duerme la instancia a los ~15 min sin tráfico. Para que el
loop de 24 h del scraper se dispare, un servicio externo gratis (UptimeRobot,
cron-job.org) debe **pinguear el URL del scraper cada ~10 min**. En UptimeRobot:
tipo **HTTP(S)** → `https://<scraper>.onrender.com/` → intervalo 5-10 min.

> El scraper corre **inmediatamente al desplegar** (primera corrida) y luego cada
> 24 h a las **08:00 UTC** (05:00 ART). La hora se ajusta con `SCRAPER_HORA_UTC`.

### 4. Verificación

```bash
curl https://<backend>.onrender.com/                       # health check
curl https://<backend>.onrender.com/conciertos            # array (vacío al inicio)
curl -X GET -H "X-Admin-Token: <ADMIN_TOKEN>" \           # llenar la base
     https://<backend>.onrender.com/scrape_conciertos_agendade
```