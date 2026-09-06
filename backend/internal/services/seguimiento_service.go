package services

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"bassonicos/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NormalizarArtista normaliza el nombre del artista (minúsculas y sin espacios)
// para el matching con conciertos y para el UNIQUE de la tabla seguidos.
func NormalizarArtista(artista string) string {
	return strings.ToLower(strings.TrimSpace(artista))
}

// ListarSeguidos devuelve los artistas que sigue el usuario (ordenados).
func ListarSeguidos(ctx context.Context, pool *pgxpool.Pool, userID int) ([]string, error) {
	rows, err := pool.Query(ctx,
		`SELECT artista FROM seguidos WHERE usuario_id = $1 ORDER BY artista`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("consulta seguidos: %w", err)
	}
	defer rows.Close()

	seguidos := make([]string, 0)
	for rows.Next() {
		var artista string
		if err := rows.Scan(&artista); err != nil {
			return nil, err
		}
		seguidos = append(seguidos, artista)
	}
	return seguidos, rows.Err()
}

// ExisteArtista indica si el artista tiene al menos un concierto en la base
// (se usa para validar que se pueda seguir a un artista existente).
func ExisteArtista(ctx context.Context, pool *pgxpool.Pool, artista string) (bool, error) {
	var existe bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM conciertos WHERE lower(btrim(artista)) = $1)`,
		NormalizarArtista(artista),
	).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar artista: %w", err)
	}
	return existe, nil
}

// SeguirArtista guarda el seguimiento (idempotente ante duplicados).
func SeguirArtista(ctx context.Context, pool *pgxpool.Pool, userID int, artista string) error {
	_, err := pool.Exec(ctx,
		`INSERT INTO seguidos (usuario_id, artista) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, NormalizarArtista(artista),
	)
	if err != nil {
		return fmt.Errorf("insertar seguido: %w", err)
	}
	return nil
}

// DejarDeSeguir quita el seguimiento (idempotente).
func DejarDeSeguir(ctx context.Context, pool *pgxpool.Pool, userID int, artista string) error {
	_, err := pool.Exec(ctx,
		`DELETE FROM seguidos WHERE usuario_id = $1 AND artista = $2`,
		userID, NormalizarArtista(artista),
	)
	if err != nil {
		return fmt.Errorf("eliminar seguido: %w", err)
	}
	return nil
}

// RegistrarNovedades crea notificaciones para los usuarios que siguen a un
// artista que ganó conciertos nuevos desde `desde` (post-scrape). Idempotente.
func RegistrarNovedades(ctx context.Context, pool *pgxpool.Pool, desde time.Time) (int, error) {
	cmd, err := pool.Exec(ctx, `
        INSERT INTO notificaciones (usuario_id, concierto_id)
        SELECT s.usuario_id, cn.id
        FROM conciertos cn
        JOIN seguidos s ON lower(btrim(s.artista)) = lower(btrim(cn.artista))
        WHERE cn.creado_en >= $1
        ON CONFLICT (usuario_id, concierto_id) DO NOTHING`,
		desde,
	)
	if err != nil {
		return 0, fmt.Errorf("registrar novedades: %w", err)
	}
	return int(cmd.RowsAffected()), nil
}

// colsNotificacion agrega los metadatos de la notificación a las columnas de un
// concierto (leerFilasNotificacion escanea en ese mismo orden).
const colsNotificacion = colsConcierto + `,
    n.id                          AS notif_id,
    n.leida                       AS notif_leida,
    n.creado_en                   AS notif_creado_en
`

func leerFilasNotificacion(rows pgx.Rows) ([]models.Notificacion, error) {
	notificaciones := make([]models.Notificacion, 0)
	for rows.Next() {
		var fila filaConcierto
		var notifID sql.NullInt64
		var notifLeida bool
		var notifCreadoEn time.Time

		if err := rows.Scan(
			&fila.cID, &fila.nombre, &fila.artista, &fila.urlEvento, &fila.ubicacion,
			&fila.isAgotado, &fila.isAptoMenores, &fila.fechaStr, &fila.horaStr,
			&fila.venueID, &fila.venueNombre, &fila.venueCapacidad, &fila.venueLng, &fila.venueLat, &fila.venueURLMaps,
			&notifID, &notifLeida, &notifCreadoEn,
		); err != nil {
			return nil, err
		}

		notificaciones = append(notificaciones, models.Notificacion{
			ID:        int(notifID.Int64),
			Leida:     notifLeida,
			CreadoEn:  notifCreadoEn,
			Concierto: fila.concierto(),
		})
	}
	return notificaciones, rows.Err()
}

// ListarNotificaciones devuelve el conteo de no leídas y la lista completa de
// notificaciones del usuario (cada una con su concierto, mismo shape que /conciertos).
func ListarNotificaciones(ctx context.Context, pool *pgxpool.Pool, userID int) (int, []models.Notificacion, error) {
	var noLeidas int
	err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notificaciones WHERE usuario_id = $1 AND NOT leida`,
		userID,
	).Scan(&noLeidas)
	if err != nil {
		return 0, nil, fmt.Errorf("contar novedades no leídas: %w", err)
	}

	query := `SELECT ` + colsNotificacion + `
        FROM notificaciones n
        JOIN conciertos c ON c.id = n.concierto_id
        LEFT JOIN ubicaciones u ON u.id = c.ubicacion
        WHERE n.usuario_id = $1
        ORDER BY n.creado_en DESC, n.id DESC`

	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		return 0, nil, fmt.Errorf("consulta novedades: %w", err)
	}
	defer rows.Close()

	notificaciones, err := leerFilasNotificacion(rows)
	if err != nil {
		return 0, nil, err
	}
	return noLeidas, notificaciones, nil
}

// MarcarLeida marca una notificación como leída (idempotente).
func MarcarLeida(ctx context.Context, pool *pgxpool.Pool, userID, notifID int) error {
	_, err := pool.Exec(ctx,
		`UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2`,
		notifID, userID,
	)
	if err != nil {
		return fmt.Errorf("marcar novedad leída: %w", err)
	}
	return nil
}

// MarcarTodasLeidas marca todas las notificaciones del usuario como leídas.
func MarcarTodasLeidas(ctx context.Context, pool *pgxpool.Pool, userID int) error {
	_, err := pool.Exec(ctx,
		`UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("marcar todas leídas: %w", err)
	}
	return nil
}