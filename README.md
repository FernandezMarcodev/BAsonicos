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
| Base       | PostgreSQL + PostGIS 16 (Docker)                                  |
| Scraper    | Python (requests + BeautifulSoup) + Nominatim                     |
| Frontend   | React 18 + Vite 7 + TypeScript, Tailwind CSS v4, Leaflet, react-router |
| Deploy     | Render (web service Go + static frontend)                        |

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

> El backend ejecuta el scraper automáticamente al iniciar y luego cada 48 h
> (`SCRAPER_INTERVALO_MINUTOS`). También se puede correr manualmente:
> `python scraper.py scrape` o `python scraper.py mantenimiento`.

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
| `SCRAPER_INTERVALO_MINUTOS` | Intervalo del scrape automático (2880 = 48 h)     |
| `KEEP_ALIVE_URL`          | URL propia para keep-alive (Render)                 |
| `JWT_SECRET`              | Secreto para firmar tokens (¡cambiar en producción!)|
| `PYTHON_CMD`              | Intérprete de Python con psycopg2 (apuntar al venv) |
| `SCRAPER_PATH` / `SCRAPER_RUN_DIR` | Ruta y directorio del script del scraper   |

### Frontend (`frontend/.env`)

| Variable       | Descripción                          |
| -------------- | ------------------------------------ |
| `VITE_API_URL` | URL base de la API (default local)   |
| `VITE_OSM_URL` | Plantilla de tiles OSM (default `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) |

## Deploy en Render

Ver `render.yaml` (blueprint de backend Go + frontend estático). Aplicar desde el dashboard
de Render con **Blueprint**. Las credenciales de la base y `JWT_SECRET` se setean como
secretos (`sync: false`).