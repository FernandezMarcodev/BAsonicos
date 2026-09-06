# Especificación de Requisitos de Software · BAsónicos

Documento de requisitos siguiendo la estructura general de la **IEEE 29148-2018**
(Especificación de Requisitos de Software, SRS). Los requisitos no funcionales se
clasifican según **Sommerville** (reinos *producto*, *organizacional* y *externo*).

---

## 1. Introducción

### 1.1 Propósito
Definir los requisitos funcionales y no funcionales de **BAsónicos**, el mapa de
conciertos del Gran Buenos Aires (ex "Concierto Finder").

### 1.2 Alcance
- **Frontend**: SPA en React 18 + TypeScript (Vite 7, Tailwind CSS v4, Leaflet).
- **Backend**: API REST en Go 1.27 (Gin), autenticación JWT, hashing bcrypt, compresión gzip.
- **Datos**: PostgreSQL 16 + PostGIS, scraper Python (requests + BeautifulSoup).
- **Deploy**: Render (servicio web Go + estático).
- Fuera de alcance: pagos online, multiusuarios avanzados, apps nativas.

### 1.3 Definiciones y acrónimos
- **Concierto**: evento musical con fecha, lugar y disponibilidad.
- **Venue/ubicación**: lugar físico geolocalizado.
- **Novedad**: notificación cuando un artista seguido suma una fecha nueva.
- **NFR/RF**: requisito no funcional / funcional. **SRS**: Especificación de Requisitos de Software.

### 1.4 Referencias
- IEEE 29148-2018. Sommerville, *Ingeniería de Software* (10.ª ed.), cap. 4.
- README.md, COMO_USAR.md, docs/arquitectura.md, docs/base_de_datos.md.

---

## 2. Descripción general del producto

### 2.1 Perspectiva
Sistema web cliente-servidor. El frontend consume la API por JSON; el backend mantiene el
catálogo con un scraper programado (default 2880 min) y genera novedades post-scrape.
Reemplaza un backend histórico Flask.

### 2.2 Funciones del producto
Explorar conciertos en mapa/lista, filtrar por artista y cercanía (hasta 50 km), registrar
cuentas con contraseña robusta, iniciar/cerrar sesión, guardar/quitar favoritos, seguir/
dejar de seguir artistas, recibir y gestionar novedades, modo oscuro y estilos de mapa.

### 2.3 Usuarios
- **Visitante**: explora y filtra sin cuenta.
- **Registrado**: además, favoritos, seguidos y novedades.

---

## 3. Requisitos funcionales (RF)

| ID | Descripción | Criterio de aceptación |
| --- | --- | --- |
| RF-01 | Explorar conciertos en un mapa interactivo con marcadores por venue. | Cada concierto con coordenadas muestra marcador y popup con lugar y fecha. |
| RF-02 | Alternar entre vista mapa y vista lista (y ambas en pantallas grandes). | El control segmentado persiste la vista elegida durante la sesión. |
| RF-03 | Filtrar por artista con búsqueda y sugerencias (teclado ↑/↓, Enter, Esc). | Al elegir una sugerencia solo quedan conciertos de ese artista. |
| RF-04 | Buscar por cercanía a la ubicación del usuario con radio configurable. | Con geolocalización activa y radio `1..50 km`, se muestran los conciertos cuya distancia haverseno ≤ radio. |
| RF-05 | Mostrar detalle del concierto: fecha, hora, lugar, disponibilidad, botones **Entradas**, **Cómo llegar** y **Ver en mapa**. | Los enlaces abren la página oficial y Google Maps; "Ver en mapa" centra y hace zoom. |
| RF-06 | Registro de cuenta con nombre, correo y contraseña. | La contraseña cumple la política (ver RNF-P-03); correo único normalizado (409 si existe). |
| RF-07 | Inicio de sesión. | Credenciales válidas → `{token, usuario}` (JWT 24 h); inválidas → 401. |
| RF-08 | Cierre de sesión y persistencia de sesión. | El token en `localStorage` restaura la sesión; cerrar lo elimina. |
| RF-09 | Favoritos: listar, agregar y quitar. | Operaciones idempotentes (POST/DELETE no fallan al repetir); el corazón refleja el estado. |
| RF-10 | Seguir/dejar de seguir artistas. | Idempotente; botón alterna Seguir ↔ Siguiendo; requiere sesión. |
| RF-11 | Novedades: contador de no leídas, listado con su concierto, marcar leída/leídas. | Tras un scrape con fechas nuevas de artistas seguidos aparecen notificaciones (ON CONFLICT, sin duplicados). |
| RF-12 | Modo oscuro y estilos de mapa (auto/claro/oscuro). | La preferencia persiste (`localStorage`). |
| RF-13 | Guía de uso en `/ayuda` (misma info que COMO_USAR.md). | Los pasos de la guía coinciden con el comportamiento real. |
| RF-14 | Health check en `/`. | Responde `200 OK` y un texto HTML simple. |
| RF-15 | Scrape manual vía `GET /scrape_conciertos_agendade`. | Dispara el scraper y devuelve el resultado (exitoso/filas). |
| RF-16 | Actualización automática de datos (schedulers). | `loopScraper`, `loopMantenimiento` y `loopKeepAlive` corren en goroutines. |

---

## 4. Requisitos no funcionales (RNF) · clasificación de Sommerville

### 4.A Producto

| ID | Subcategoría | Requisito |
| --- | --- | --- |
| RNF-P-01 | Usabilidad | Interfaz mobile-first, en español rioplatense, consistente (tokens de diseño, modo oscuro). Guía integrada. |
| RNF-P-02 | Eficiencia/rendimiento | Respuestas JSON comprimidas con gzip; índices sobre las consultas frecuentes; pool pgx 2–8 conexiones; objetivo < 200 ms para `GET /conciertos` en carga normal. |
| RNF-P-03 | Seguridad | Contraseñas con bcrypt (coste 10); política: **mínimo 8 caracteres**, al menos una mayúscula, minúscula, número y carácter especial, máximo 72 (límite bcrypt); validación en servidor y cliente; JWT HS256 firmado con `JWT_SECRET`; `NoStore` en respuestas autenticadas; errores de login sin revelar si el correo existe. |
| RNF-P-04 | Fiabilidad | Operaciones idempotentes (`ON CONFLICT DO NOTHING`); integración de base idempotente al arrancar; entradas duplicadas limpiadas por mantenimiento. |
| RNF-P-05 | Espacio | SQLite: no; distribución liviana: el frontend genera un build estático estándar; el scraper es proceso externo (no bloquea la API). |

### 4.B Organizacionales

| ID | Subcategoría | Requisito |
| --- | --- | --- |
| RNF-O-01 | Entrega | Despliegue reproducible en Render vía `render.yaml` (blueprint) con secretos `sync: false` y pasos en README. |
| RNF-O-02 | Implementación | Go idiomático (`go vet` limpio), TypeScript estricto (`tsc -b`), ESLint sin warnings; código en español; sin comentarios superfluos. |
| RNF-O-03 | Proceso | Migraciones idempotentes (DDL `IF NOT EXISTS`); credenciales jamás versionadas (`.gitignore`); documentación mantenida junto al código. |

### 4.C Externos

| ID | Subcategoría | Requisito |
| --- | --- | --- |
| RNF-E-01 | Interoperabilidad | API REST JSON estable (rutas documentadas en README); tiles de OpenStreetMap; geocodificación vía Nominatim en el scraper. |
| RNF-E-02 | Legales/regulatorios | Acreditación de la fuente (**agendade.com.ar**) en la app y en la documentación; atribución conforme a licencias de OSM. |
| RNF-E-03 | Privacidad | Datos personales mínimos (email, nombre); contraseñas solo como hash; tokens expirables; la ubicación se usa solo client-side. |
| RNF-E-04 | Accesibilidad | Contraste claro/oscuro adecuado, `aria-label` en controles iconográficos, navegación por teclado y `role` en combobox/switch, textos alfabéticos visibles (no solo icono). |

---

## 5. Atributos de calidad (priorización DICES)

| Requisito | Tipo | Valor |
| --- | --- | --- |
| Autenticación segura | Seguridad | Alta |
| Rendimiento de carga | Eficiencia | Media |
| Móvil-first | Usabilidad | Alta |
| Interoperabilidad con agendade/OSM | Externo | Alta |

---

## 6. Reglas de negocio / restricciones

- Un concierto pertenece a una única ubicación (FK `conciertos.ubicacion`).
- Favorito y novedad son únicos por `(usuario_id, concierto_id)`.
- Seguir un artista requiere que el artista tenga al menos un concierto.
- El email de usuario es único e insensible a mayúsculas (normalizado a minúsculas).

---

## 7. Verificación

- **Backend**: `go build ./...`, `go vet ./...`.
- **Frontend**: `npm run typecheck`, `npm run lint`, `npm run build`.
- **Funcional**: suite `test_seguidos.ps1` (22/22) contra API local; smoke `GET /` y `GET /conciertos`.
- **Seguridad**: prueba de registro rechazando contraseñas que no cumplen la política (cada regla por separado).

---

## 8. Riesgos y mitigación

| Riesgo | Mitigación |
| --- | --- |
| `agendade.com.ar` cambia su HTML | Scraper aislado y `mantenimiento` de pasadas/duplicados. |
| Rate limit de Nominatim/OSM | Scraper se ejecuta con intervalo amplio y tolera fallos. |
| `JWT_SECRET` débil en producción | Secretos vía variables de entorno (Render `sync: false`). |
| Crecimiento del catálogo | Índices por fecha/artista/ubicación y gzip de respuestas. |

---

## Apéndice A. Trazabilidad raíz (implícita)

- RF-01..05 → `Inicio.tsx`, `Mapa.tsx`, `Filtros.tsx`, `TarjetaConcierto.tsx`.
- RF-06..08 → `Registro.tsx`, `Login.tsx`, `AuthContext.tsx`, `handlers/auth.go`.
- RF-09..11 → `FavoritosContext.tsx`, `SeguidosContext.tsx`, `Encabezado.tsx`, `handlers/favoritos.go`, `handlers/seguidos.go`.
- RF-12..16 → `TemaContext.tsx`, `Ayuda.tsx`, `handlers/scrape.go`, `services/scraper_service.go`.