# Multi-stage: la imagen Go nativa de Render no incluye Python, así que esta
# imagen empaqueta el binario Go + Python 3 + el scraper (scraper/). El scraper
# corre como subproceso del backend (ver internal/services/scraper_service.go),
# nunca como servicio HTTP expuesto.

# Stage 1: compila el backend Go.
FROM golang:1.27 AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

# Stage 2: imagen runtime liviana con Python 3 para el scraper.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
COPY scraper/ /opt/scraper/
RUN /opt/venv/bin/pip install --no-cache-dir -r /opt/scraper/requirements.txt
COPY --from=build /out/server /app/server

ENV PYTHON_CMD=/opt/venv/bin/python \
    SCRAPER_PATH=/opt/scraper/scraper.py \
    SCRAPER_RUN_DIR=/opt/scraper \
    PORT=10000 \
    HOST=0.0.0.0

EXPOSE 10000
CMD ["/app/server"]