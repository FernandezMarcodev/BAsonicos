package services

import (
	"context"
	"database/sql"
	"fmt"

	"bassonicos/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const colsConcierto = `
    c.id,
    c.nombre,
    c.artista,
    c.url_evento,
    c.ubicacion,
    COALESCE(c.isagotado, FALSE)     AS isagotado,
    COALESCE(c.isaptomenores, FALSE) AS isaptomenores,
    to_char(c.fecha, 'YYYY-MM-DD')  AS fecha_str,
    to_char(c.hora, 'HH24:MI:SS')   AS hora_str,
    u.id                            AS venue_id,
    u.nombre                        AS venue_nombre,
    u.capacidad_total               AS venue_capacidad,
    ST_X(u.coordenadas)             AS venue_lng,
    ST_Y(u.coordenadas)             AS venue_lat,
    u.url_maps                      AS venue_url_maps
`

// filaConcierto agrupa las columnas compartidas de un concierto (colsConcierto).
// Se usa en todas las consultas que devuelven conciertos (lista, favoritos,
// novedades) para escanear y construir el modelo una sola vez.
type filaConcierto struct {
	cID, venueID               sql.NullInt64
	nombre, artista, urlEvento sql.NullString
	ubicacion                  sql.NullInt64
	isAgotado, isAptoMenores   bool
	fechaStr, horaStr          sql.NullString
	venueNombre, venueURLMaps  sql.NullString
	venueCapacidad             sql.NullInt64
	venueLng, venueLat         sql.NullFloat64
}

func (f *filaConcierto) escanear(fila interface{ Scan(dest ...any) error }) error {
	return fila.Scan(
		&f.cID, &f.nombre, &f.artista, &f.urlEvento, &f.ubicacion,
		&f.isAgotado, &f.isAptoMenores, &f.fechaStr, &f.horaStr,
		&f.venueID, &f.venueNombre, &f.venueCapacidad, &f.venueLng, &f.venueLat, &f.venueURLMaps,
	)
}

func (f filaConcierto) concierto() models.Concierto {
	concierto := models.Concierto{
		ID:            int(f.cID.Int64),
		Nombre:        f.nombre.String,
		Artista:       f.artista.String,
		URLEvento:     nullableString(f.urlEvento),
		Ubicacion:     nullableInt(f.ubicacion),
		IsAgotado:     f.isAgotado,
		IsAptoMenores: f.isAptoMenores,
		Fecha:         nullableString(f.fechaStr),
		Hora:          nullableString(f.horaStr),
	}

	if f.venueID.Valid && f.venueNombre.Valid {
		detalle := models.UbicacionDetalle{
			ID:             int(f.venueID.Int64),
			Nombre:         f.venueNombre.String,
			CapacidadTotal: int(f.venueCapacidad.Int64),
			URLMaps:        nullableString(f.venueURLMaps),
		}
		if f.venueLng.Valid && f.venueLat.Valid {
			detalle.Coordenadas = &models.Coordenadas{f.venueLng.Float64, f.venueLat.Float64}
		}
		concierto.UbicacionDetalle = &detalle
	}

	return concierto
}

func leerFilasConcierto(rows pgx.Rows) ([]models.Concierto, error) {
	conciertos := make([]models.Concierto, 0)
	for rows.Next() {
		var fila filaConcierto
		if err := fila.escanear(rows); err != nil {
			return nil, err
		}
		conciertos = append(conciertos, fila.concierto())
	}
	return conciertos, rows.Err()
}

// GetConciertos devuelve todos los conciertos (paridad con GET /conciertos Flask).
func GetConciertos(ctx context.Context, pool *pgxpool.Pool) ([]models.Concierto, error) {
	query := `SELECT ` + colsConcierto + `
        FROM conciertos c
        LEFT JOIN ubicaciones u ON u.id = c.ubicacion`

	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("consulta conciertos: %w", err)
	}
	defer rows.Close()

	return leerFilasConcierto(rows)
}

// ListarFavoritos devuelve los conciertos favoritos del usuario (mismo shape que /conciertos).
func ListarFavoritos(ctx context.Context, pool *pgxpool.Pool, userID int) ([]models.Concierto, error) {
	query := `SELECT ` + colsConcierto + `
        FROM conciertos c
        JOIN favoritos f ON f.concierto_id = c.id
        LEFT JOIN ubicaciones u ON u.id = c.ubicacion
        WHERE f.usuario_id = $1
        ORDER BY c.fecha ASC NULLS LAST, c.hora ASC NULLS LAST, c.id ASC`

	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("consulta favoritos: %w", err)
	}
	defer rows.Close()

	return leerFilasConcierto(rows)
}

// ExisteConcierto indica si un concierto existe en la base.
func ExisteConcierto(ctx context.Context, pool *pgxpool.Pool, conciertoID int) (bool, error) {
	var existe bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM conciertos WHERE id = $1)`,
		conciertoID,
	).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar concierto: %w", err)
	}
	return existe, nil
}

// AgregarFavorito guarda el favorito (idempotente ante duplicados).
func AgregarFavorito(ctx context.Context, pool *pgxpool.Pool, userID, conciertoID int) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO favoritos (usuario_id, concierto_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, conciertoID,
	)
	if err != nil {
		return fmt.Errorf("insertar favorito: %w", err)
	}
	return nil
}

// EliminarFavorito quita el favorito (idempotente).
func EliminarFavorito(ctx context.Context, pool *pgxpool.Pool, userID, conciertoID int) error {
	_, err := pool.Exec(ctx,
		`DELETE FROM favoritos WHERE usuario_id = $1 AND concierto_id = $2`,
		userID, conciertoID,
	)
	if err != nil {
		return fmt.Errorf("eliminar favorito: %w", err)
	}
	return nil
}

func nullableString(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}

func nullableInt(i sql.NullInt64) *int {
	if !i.Valid {
		return nil
	}
	v := int(i.Int64)
	return &v
}