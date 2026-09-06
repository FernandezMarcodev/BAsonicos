package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"bassonicos/internal/config"

	"github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SuscripcionPush representa una suscripción Web Push guardada para un usuario.
type SuscripcionPush struct {
	ID       int
	Endpoint string
	P256dh   string
	Auth     string
}

// GuardarSuscripcionPush guarda o actualiza (por endpoint) la suscripción push
// de un usuario. Idempotente ante re-suscripciones del mismo navegador.
func GuardarSuscripcionPush(ctx context.Context, pool *pgxpool.Pool, userID int, endpoint, p256dh, auth, userAgent string) error {
	_, err := pool.Exec(ctx, `
        INSERT INTO suscripciones_push (usuario_id, endpoint, clave_p256dh, clave_auth, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (usuario_id, endpoint) DO UPDATE
            SET clave_p256dh = EXCLUDED.clave_p256dh,
                clave_auth = EXCLUDED.clave_auth,
                user_agent = EXCLUDED.user_agent`,
		userID, endpoint, p256dh, auth, userAgent,
	)
	if err != nil {
		return fmt.Errorf("guardar suscripción push: %w", err)
	}
	return nil
}

// EliminarSuscripcionPush quita la suscripción push del usuario (desactivar
// notificaciones). Idempotente.
func EliminarSuscripcionPush(ctx context.Context, pool *pgxpool.Pool, userID int, endpoint string) error {
	_, err := pool.Exec(ctx,
		`DELETE FROM suscripciones_push WHERE usuario_id = $1 AND endpoint = $2`,
		userID, endpoint,
	)
	if err != nil {
		return fmt.Errorf("eliminar suscripción push: %w", err)
	}
	return nil
}

// ListarSuscripcionesPush devuelve las suscripciones push de un usuario.
func ListarSuscripcionesPush(ctx context.Context, pool *pgxpool.Pool, userID int) ([]SuscripcionPush, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, endpoint, clave_p256dh, clave_auth FROM suscripciones_push WHERE usuario_id = $1`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("consulta suscripciones push: %w", err)
	}
	defer rows.Close()

	suscripciones := make([]SuscripcionPush, 0)
	for rows.Next() {
		var s SuscripcionPush
		if err := rows.Scan(&s.ID, &s.Endpoint, &s.P256dh, &s.Auth); err != nil {
			return nil, err
		}
		suscripciones = append(suscripciones, s)
	}
	return suscripciones, rows.Err()
}

// novedadPush agrupa un concierto nuevo con los datos que interesan para el push.
type novedadPush struct {
	UsuarioID int
	Artista   string
	Nombre    string
	Fecha     string
	Hora      string
	Lugar     string
	ConciertoID int
}

// VapidActivo indica si hay claves VAPID configuradas para enviar push.
func VapidActivo(cfg config.Config) bool {
	return cfg.VAPIDPublicKey != "" && cfg.VAPIDPrivateKey != ""
}

// EnviarNovedadesPush envía notificaciones push a los usuarios que recibieron
// novedades (notificaciones insertadas) desde `desde`. Por usuario se agrupa en
// un único push con un resumen de hasta 3 eventos.
func EnviarNovedadesPush(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, desde time.Time) error {
	if !VapidActivo(cfg) {
		return nil
	}

	rows, err := pool.Query(ctx, `
        SELECT DISTINCT n.usuario_id, c.artista, c.nombre,
               to_char(c.fecha, 'YYYY-MM-DD') AS fecha_str,
               to_char(c.hora, 'HH24:MI')     AS hora_str,
               u.nombre                        AS lugar,
               c.id
        FROM notificaciones n
        JOIN conciertos c ON c.id = n.concierto_id
        LEFT JOIN ubicaciones u ON u.id = c.ubicacion
        WHERE n.creado_en >= $1
          AND EXISTS(SELECT 1 FROM suscripciones_push sp WHERE sp.usuario_id = n.usuario_id)
        ORDER BY n.usuario_id, n.id`,
		desde,
	)
	if err != nil {
		return fmt.Errorf("consulta novedades para push: %w", err)
	}
	defer rows.Close()

	// Agrupar por usuario.
	porUsuario := make(map[int][]novedadPush)
	for rows.Next() {
		var n novedadPush
		var lugar sql.NullString
		if err := rows.Scan(&n.UsuarioID, &n.Artista, &n.Nombre, &n.Fecha, &n.Hora, &lugar, &n.ConciertoID); err != nil {
			return err
		}
		n.Lugar = lugar.String
		porUsuario[n.UsuarioID] = append(porUsuario[n.UsuarioID], n)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for userID, novedades := range porUsuario {
		if err := enviarPushUsuario(ctx, cfg, pool, userID, novedades); err != nil {
			fmt.Printf("AVISO: no se pudo enviar push al usuario %d: %v\n", userID, err)
		}
	}
	return nil
}

// enviarPushUsuario arma el mensaje resumen y lo envía a todas las suscripciones
// del usuario. Los endpoints que responden 404/410 (suscripción vencida) se borran.
func enviarPushUsuario(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, userID int, novedades []novedadPush) error {
	suscripciones, err := ListarSuscripcionesPush(ctx, pool, userID)
	if err != nil || len(suscripciones) == 0 {
		return err
	}

	titulo := "Novedades de tus artistas"
	if len(novedades) == 1 {
		titulo = "Nuevo concierto de " + novedades[0].Artista
	}

	maximo := len(novedades)
	if maximo > 3 {
		maximo = 3
	}
	lineas := make([]string, 0, maximo)
	for _, n := range novedades[:maximo] {
		linea := n.Nombre
		if n.Fecha != "" {
			linea += " · " + n.Fecha
		}
		if n.Hora != "" {
			linea += " " + n.Hora + " hs"
		}
		if n.Lugar != "" {
			linea += " en " + n.Lugar
		}
		lineas = append(lineas, linea)
	}
	if len(novedades) > maximo {
		lineas = append(lineas, fmt.Sprintf("y %d más", len(novedades)-maximo))
	}

	payload, err := json.Marshal(map[string]any{
		"titulo":        titulo,
		"cuerpo":        strings.Join(lineas, "\n"),
		"icono":         "/icon-192.png",
		"badge":         "/icon-192.png",
		"url":           "/?novedades=1",
		"fecha":         time.Now().Unix(),
	})
	if err != nil {
		return fmt.Errorf("serializar push: %w", err)
	}

	for _, s := range suscripciones {
		suscripcion := webpush.Subscription{
			Endpoint: s.Endpoint,
			Keys: webpush.Keys{
				P256dh: s.P256dh,
				Auth:   s.Auth,
			},
		}
		opciones := &webpush.Options{
			Subscriber:      cfg.VAPIDSubject,
			VAPIDPublicKey:  cfg.VAPIDPublicKey,
			VAPIDPrivateKey: cfg.VAPIDPrivateKey,
			TTL:             24 * 60 * 60,
			Urgency:         webpush.UrgencyNormal,
		}
		resp, err := webpush.SendNotification(payload, &suscripcion, opciones)
		if err != nil {
			fmt.Printf("AVISO: push fallido a %s: %v\n", s.Endpoint, err)
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == 404 || resp.StatusCode == 410 {
			// El navegador dio de baja la suscripción; la limpiamos.
			if err := EliminarSuscripcionPush(ctx, pool, userID, s.Endpoint); err != nil {
				fmt.Printf("AVISO: no se pudo borrar suscripción vencida: %v\n", err)
			}
		}
	}
	return nil
}

// UsuarioConSuscripcionPush indica si el usuario tiene al menos una suscripción push.
func UsuarioConSuscripcionPush(ctx context.Context, pool *pgxpool.Pool, userID int) (bool, error) {
	var existe bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM suscripciones_push WHERE usuario_id = $1)`,
		userID,
	).Scan(&existe)
	if err != nil {
		return false, fmt.Errorf("verificar suscripción push: %w", err)
	}
	return existe, nil
}