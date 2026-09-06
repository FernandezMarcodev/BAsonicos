package db

import (
	"context"
	"fmt"
	"time"

	"bassonicos/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

const ddl = `
CREATE TABLE IF NOT EXISTS ubicaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    capacidad_total INTEGER NOT NULL,
    coordenadas GEOMETRY(POINT, 4326),
    url_maps VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS conciertos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    artista VARCHAR(50) NOT NULL,
    url_evento VARCHAR(100),
    ubicacion INTEGER REFERENCES ubicaciones(id) ON DELETE CASCADE,
    isagotado BOOLEAN DEFAULT FALSE,
    isaptomenores BOOLEAN DEFAULT FALSE,
    fecha DATE,
    hora TIME
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favoritos (
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    concierto_id INTEGER NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, concierto_id)
);

ALTER TABLE conciertos ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS seguidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    artista TEXT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, artista)
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    concierto_id INTEGER NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, concierto_id)
);

CREATE TABLE IF NOT EXISTS suscripciones_push (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    clave_p256dh TEXT NOT NULL,
    clave_auth TEXT NOT NULL,
    user_agent TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_conciertos_ubicacion ON conciertos (ubicacion);
CREATE INDEX IF NOT EXISTS idx_conciertos_fecha ON conciertos (fecha, hora);
CREATE INDEX IF NOT EXISTS idx_conciertos_artista_lower ON conciertos (lower(btrim(artista)));
CREATE INDEX IF NOT EXISTS idx_favoritos_concierto ON favoritos (concierto_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones (usuario_id, leida, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_concierto ON notificaciones (concierto_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_usuario ON suscripciones_push (usuario_id);
`

// Connect crea el pool de conexiones, verifica la extensión PostGIS y crea las
// tablas si no existen (comportamiento idempotente igual que el backend Flask).
func Connect(cfg config.Config) (*pgxpool.Pool, error) {
	// Formato keyword/value de libpq/pgx: los valores se separan por espacio.
	// Usar "&" como separador (sintaxis de query-string de URL) corrompe el
	// password y no aplica sslmode, rompiendo el login en prod (Supabase/Neon/Render).
	dsn := fmt.Sprintf(
		"host=%s port=%s dbname=%s user=%s password=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Pool con un par de conexiones mínimas calientes (evita latencia de conexión
	// en el primer request) y un tope cómodo para el plan gratis de Render.
	pgxCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("no se pudo configurar el pool: %w", err)
	}

	// sslmode se aplica como RuntimeParam (no en el DSN) para no corromper el parseo.
	if cfg.DBSSLMode != "" {
		pgxCfg.ConnConfig.RuntimeParams["sslmode"] = cfg.DBSSLMode
	}
	pgxCfg.MinConns = 2
	pgxCfg.MaxConns = 8

	pool, err := pgxpool.NewWithConfig(ctx, pgxCfg)
	if err != nil {
		return nil, fmt.Errorf("no se pudo crear el pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("no se pudo conectar a la base: %w", err)
	}

	// Verificar/crear extensión PostGIS requerida por ST_DWithin y Geometry.
	if _, err := pool.Exec(ctx, "CREATE EXTENSION IF NOT EXISTS postgis"); err != nil {
		pool.Close()
		return nil, fmt.Errorf("no se pudo verificar la extensión postgis: %w", err)
	}

	if _, err := pool.Exec(ctx, ddl); err != nil {
		pool.Close()
		return nil, fmt.Errorf("no se pudieron crear/verificar las tablas: %w", err)
	}

	return pool, nil
}