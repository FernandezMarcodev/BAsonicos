package services

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"sync"
	"time"

	"bassonicos/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

// lockScraper garantiza que el script Python nunca se ejecute dos veces en
// paralelo (evita conflictos de escritura en la base y sobrecarga).
var lockScraper sync.Mutex

func newHTTPClient() *http.Client {
	return &http.Client{Timeout: 30 * time.Second}
}

const timeoutScraper = 3 * time.Hour

type ScrapeResult struct {
	Modo   string `json:"modo"`
	Exitoso bool  `json:"exitoso"`
	Log    string `json:"log"`
}

// EjecutarScraper lanza el script Python (modo "scrape" o "mantenimiento") y
// captura su salida combinada. El scraper sigue siendo un script de Python que
// escribe directo en la base; acá solo se orquesta.
func EjecutarScraper(ctx context.Context, cfg config.Config, modo string) (ScrapeResult, error) {
	lockScraper.Lock()
	defer lockScraper.Unlock()

	cmdCtx, cancel := context.WithTimeout(ctx, timeoutScraper)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, cfg.PythonCmd, cfg.ScraperPath, modo)
	cmd.Dir = cfg.ScraperRunDir

	salida, err := cmd.CombinedOutput()
	if err != nil {
		return ScrapeResult{
			Modo:   modo,
			Exitoso: false,
			Log:    string(salida),
		}, fmt.Errorf("scraper falló (modo %s): %w", modo, err)
	}

	// Cortar el log para respuestas HTTP manejables (el scraper imprime mucho).
	log := string(salida)
	if len(log) > 50000 {
		log = log[len(log)-50000:]
	}

	return ScrapeResult{Modo: modo, Exitoso: true, Log: log}, nil
}

// EjecutarScraperYRegistrarNovedades corre el scraper y, si fue un scrapeo exitoso,
// registra las notificaciones de conciertos nuevos para los usuarios con artistas
// seguidos (idempotente). Se usa tanto en el loop programado como en el manual.
func EjecutarScraperYRegistrarNovedades(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, modo string) (ScrapeResult, error) {
	t0 := time.Now()
	res, err := EjecutarScraper(ctx, cfg, modo)
	if err != nil {
		return res, err
	}
	if modo == "scrape" && res.Exitoso {
		n, nErr := RegistrarNovedades(ctx, pool, t0)
		if nErr != nil {
			fmt.Printf("AVISO: no se pudieron registrar novedades: %v\n", nErr)
		} else if n > 0 {
			fmt.Printf("Novedades registradas tras scrapeo: %d\n", n)
			if err := EnviarNovedadesPush(ctx, cfg, pool, t0); err != nil {
				fmt.Printf("AVISO: no se pudieron enviar los push de novedades: %v\n", err)
			}
		} else {
			fmt.Println("Sin novedades nuevas tras scrapeo: no se envían push.")
		}
	}
	return res, nil
}

// RunSchedulers lanza los procesos de fondo que reemplazan los threads de Flask.
func RunSchedulers(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) {
	go loopScraper(ctx, cfg, pool)
	go loopMantenimiento(ctx, cfg)
	go loopKeepAlive(ctx, cfg)
}

// loopScraper replica scheduler_scraper: primer corrido inmediato, luego cada
// SCRAPER_INTERVALO_MINUTOS. Con intervalo <= 0 queda desactivado.
func loopScraper(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) {
	if cfg.ScraperIntervaloMinutos <= 0 {
		fmt.Println("Scraper automático desactivado (SCRAPER_INTERVALO_MINUTOS=0).")
		return
	}
	intervalo := time.Duration(cfg.ScraperIntervaloMinutos) * time.Minute
	fmt.Printf("Scraper automático activado: primer corrido inmediato, luego cada %d minutos.\n", cfg.ScraperIntervaloMinutos)

	for {
		fmt.Println("Ejecutando scrapeo programado...")
		res, err := EjecutarScraperYRegistrarNovedades(ctx, cfg, pool, "scrape")
		if err != nil {
			fmt.Printf("Error en scrapeo programado: %v\n", err)
		} else {
			fmt.Printf("Scrapeo programado finalizado (exitoso=%v).\n", res.Exitoso)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(intervalo):
		}
	}
}

// loopMantenimiento replica cronjob_eliminar_conciertos: corre la limpieza
// diaria (pasados, fuera de AMBA, fusionar lugares, duplicados) cada 24 h.
func loopMantenimiento(ctx context.Context, cfg config.Config) {
	intervalo := 24 * time.Hour
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(intervalo):
		}
		fmt.Println("Iniciando cronjob diario de limpieza...")
		if _, err := EjecutarScraper(ctx, cfg, "mantenimiento"); err != nil {
			fmt.Printf("Error en cronjob de limpieza: %v\n", err)
		}
	}
}

// loopKeepAlive pingea KEEP_ALIVE_URL cada 12 minutos (evita el sleep en tiers
// gratuitos). Si no hay URL configurada no hace nada.
func loopKeepAlive(ctx context.Context, cfg config.Config) {
	if cfg.KeepAliveURL == "" {
		fmt.Println("keep_alive desactivado (sin KEEP_ALIVE_URL).")
		return
	}
	fmt.Printf("keep_alive activado hacia %s\n", cfg.KeepAliveURL)
	cliente := newHTTPClient()
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(12 * time.Minute):
		}
		reqCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, cfg.KeepAliveURL, nil)
		if err != nil {
			fmt.Printf("Error creando request keep_alive: %v\n", err)
			cancel()
			continue
		}
		resp, err := cliente.Do(req)
		if err != nil {
			fmt.Printf("Error en keep_alive: %v\n", err)
		} else {
			fmt.Printf("Keep alive status: %d\n", resp.StatusCode)
			resp.Body.Close()
		}
		cancel()
	}
}