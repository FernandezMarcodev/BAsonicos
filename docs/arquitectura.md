# Arquitectura de BAsónicos

Diagramas de arquitectura del sistema en estilo C4 (contexto → contenedores → componentes).
Los diagramas usan **Mermaid** y se renderizan en GitHub, GitLab y editores con soporte Mermaid.

## 1. Contexto (C1)

```mermaid
flowchart LR
    U["Persona · usuario final\n(navegador móvil o desktop)"]
    APP["BAsónicos\n(sistema web)"]
    AG["agendade.com.ar\n(fuente de la grilla de conciertos)"]
    NOM["Nominatim\n(geocodificación de lugares)"]
    OSM["OpenStreetMap\n(tiles del mapa)"]

    U -->|"explora, filtra, guarda favoritos,\nsigue artistas, recibe novedades"| APP
    APP -->|"consume la página con la grilla"| AG
    APP -->|"resuelve coordenadas de venues"| NOM
    APP -->|"muestra mapas y marcadores"| OSM
```

## 2. Contenedores (C2)

```mermaid
flowchart TB
    subgraph Navegador
        FE["Frontend\nReact 18 · Vite 7 · TypeScript\nTailwind CSS v4 · Leaflet (react-leaflet)"]
    end

    subgraph Servidor
        API["Backend · Go 1.27 (Gin)\nacceso JWT protegido + endpoints públicos\nrespuestas comprimidas con gzip\npool pgx 2–8 conexiones"]
        SCR["Scraper · Python\nrequests + BeautifulSoup\n(proceso externo lanzado por el backend)"]
    end

    subgraph Datos
        DB[("PostgreSQL + PostGIS 16")]
    end

    FE -->|"JSON sobre HTTP(S)"| API
    API -->|"SQL / funciones PostGIS (ST_DWithin…)"| DB
    API -->|"exec: scraper.py scrape|mantenimiento"| SCR
    SCR -->|"INSERT/UPDATE de conciertos y ubicaciones"| DB
```

## 3. Componentes del backend (C3)

```mermaid
flowchart TB
    R["Enrutador gin\n(middleware: gzip → CORS → NoStore → Auth)"]

    subgraph Handlers
        H1["Auth (registro, login, me)"]
        H2["Conciertos (GET /conciertos)"]
        H3["Favoritos (GET/POST/DELETE)"]
        H4["Seguidos (GET/POST/DELETE)"]
        H5["Novedades (GET/leida/leer_todas)"]
        H6["Scrape (GET /scrape_conciertos_agendade)"]
    end

    subgraph Servicios
        S1["auth_service (JWT HS256 · bcrypt)"]
        S2["concierto_service (lectura de conciertos)"]
        S3["seguimiento_service (seguidos + novedades)"]
        S4["scraper_service (scraper + schedulers)"]
    end

    DB[("PostgreSQL + PostGIS")]
    PY["scraper.py (Python)"]

    R --> H1 & H2 & H3 & H4 & H5 & H6
    H1 --> S1
    H2 --> S2
    H3 --> S2
    H4 --> S3
    H5 --> S3
    H6 --> S4
    S1 --> DB
    S2 --> DB
    S3 --> DB
    S4 --> DB
    S4 -->|"exec"| PY
```

## 4. Procesos en segundo plano

`RunSchedulers` (en `backend/internal/services/scraper_service.go`) arranca tres goroutines:

```mermaid
sequenceDiagram
    participant main as main()
    participant S as scraper_service
    participant PY as scraper.py
    participant DB as PostgreSQL

    main->>S: EjecutarScraper(mantenimiento)
    S->>PY: exec scraper.py mantenimiento
    PY-->>S: resultado OK/fallo
    main->>S: RunSchedulers()
    Note over S: loopScraper (cada SCRAPER_INTERVALO_MINUTOS, default 2880)\nloopMantenimiento (cada 2 h)\nloopKeepAlive (si KEEP_ALIVE_URL)
    loop Cada intervalo
        S->>PY: exec scraper.py scrape
        PY-->>S: filas nuevas
        S->>S: EjecutarScraperYRegistrarNovedades
        S->>DB: RegistrarNovedades (ON CONFLICT DO NOTHING)
    end
```

> `RegistrarNovedades` inserta notificaciones para los usuarios que siguen al artista de
> cualquier concierto nuevo ingresado **desde el último scrape** (`cn.creado_en >= desde`),
> de forma **idempotente** (`UNIQUE(usuario_id, concierto_id)`).

## 5. Despliegue (Render)

- **Backend**: servicio web Go (`render.yaml`, servicio *bassonicos-backend*),
  `PORT=10000`, base externa Postgres con `DB_SSLMODE=require`, health check en `/`.
- **Frontend**: servicio estático (*bassonicos-frontend*) que sirve `./dist`
  (build de `npm run build`) y apunta a `VITE_API_URL`.

## 6. Decisiones de estructura recientes

- Endpoints sin consumidor (`/ubicaciones`, `/conciertos_cerca`) eliminados: la cercanía se
  calcula en el cliente con la fórmula del haverseno sobre `/conciertos`.
- Lectura de filas de conciertos unificada en `filaConcierto` (conciertos, favoritos y
  novedades comparten el mismo escaneo).
- Servicios frontend unificados en `src/servicios/http.ts` (`peticion`, `ErrorApi`,
  `API_BASE_URL`), eliminando tres copias duplicadas.