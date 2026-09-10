package services

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
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

// ultimasLineas devuelve las últimas n líneas de un texto, para resumir la
// salida del scraper en los logs sin inundar la consola.
func ultimasLineas(texto string, n int) string {
	lineas := strings.Split(strings.TrimRight(texto, "\n"), "\n")
	if len(lineas) > n {
		lineas = lineas[len(lineas)-n:]
	}
	return strings.Join(lineas, "\n")
}

// EjecutarScraper lanza el script Python (modo "scrape" o "mantenimiento") y
// captura su salida combinada. El scraper sigue siendo un script de Python que
// escribe directo en la base; acá solo se orquesta. Siempre deja un registro en
// los logs con el modo, la duración y las últimas líneas de salida del script.
func EjecutarScraper(ctx context.Context, cfg config.Config, modo string) (ScrapeResult, error) {
	inicio := time.Now()
	lockScraper.Lock()
	defer lockScraper.Unlock()

	cmdCtx, cancel := context.WithTimeout(ctx, timeoutScraper)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, cfg.PythonCmd, cfg.ScraperPath, modo)
	cmd.Dir = cfg.ScraperRunDir

	salida, err := cmd.CombinedOutput()
	duracion := time.Since(inicio)
	if err != nil {
		fmt.Printf("[scraper] falló (modo=%s, duración=%s): %v\n", modo, duracion, err)
		fmt.Printf("[scraper] --- salida del script (últimas líneas) ---\n%s\n[scraper] ---------------------------------------------\n", ultimasLineas(string(salida), 40))
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

	fmt.Printf("[scraper] modo=%s finalizado (duración=%s). Salida del script:\n%s\n", modo, duracion, ultimasLineas(log, 40))

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
// Deja un banner de arranque con la configuración para que sea evidente en los
// logs qué scheduler está activo y cuál no.
func RunSchedulers(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) {
	fmt.Println("== Procesos de fondo (schedulers) ==")
	if cfg.ScraperIntervaloMinutos <= 0 {
		fmt.Println("[scheduler] Scraper automático DESACTIVADO (SCRAPER_INTERVALO_MINUTOS<=0). No se ejecutará ningún scrapeo.")
	} else {
		fmt.Printf("[scheduler] Scraper automático ACTIVADO: primera corrida inmediata, luego cada %d minutos.\n", cfg.ScraperIntervaloMinutos)
	}
	if cfg.KeepAliveURL == "" {
		fmt.Println("[scheduler] Keep-alive DESACTIVADO (sin KEEP_ALIVE_URL).")
	} else {
		fmt.Printf("[scheduler] Keep-alive ACTIVADO: ping a %s cada 12 minutos.\n", cfg.KeepAliveURL)
	}
	fmt.Println("[scheduler] Limpieza diaria (mantenimiento) cada 24 horas.")
	go loopScraper(ctx, cfg, pool)
	go loopMantenimiento(ctx, cfg)
	go loopKeepAlive(ctx, cfg)
}

// loopScraper replica scheduler_scraper: primer corrido inmediato, luego cada
// SCRAPER_INTERVALO_MINUTOS. Con intervalo <= 0 queda desactivado.
func loopScraper(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) {
	if cfg.ScraperIntervaloMinutos <= 0 {
		fmt.Println("[scraper] DESACTIVADO (SCRAPER_INTERVALO_MINUTOS<=0), no se corre el loop.")
		return
	}
	intervalo := time.Duration(cfg.ScraperIntervaloMinutos) * time.Minute
	fmt.Printf("[scraper] ACTIVADO: primera corrida inmediata, luego cada %d minutos.\n", cfg.ScraperIntervaloMinutos)

	corrida := 0
	for {
		corrida++
		fmt.Printf("[scraper] === Corrida #%d (%s) ===\n", corrida, time.Now().Format(time.RFC3339))
		res, err := EjecutarScraperYRegistrarNovedades(ctx, cfg, pool, "scrape")
		if err != nil {
			fmt.Printf("[scraper] Corrida #%d terminó con ERROR: %v\n", corrida, err)
		} else {
			fmt.Printf("[scraper] Corrida #%d finalizada (exitoso=%v).\n", corrida, res.Exitoso)
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
	corrida := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(intervalo):
		}
		corrida++
		fmt.Printf("[mantenimiento] === Limpieza diaria #%d (%s) ===\n", corrida, time.Now().Format(time.RFC3339))
		if _, err := EjecutarScraper(ctx, cfg, "mantenimiento"); err != nil {
			fmt.Printf("[mantenimiento] Limpieza #%d terminó con ERROR: %v\n", corrida, err)
		} else {
			fmt.Printf("[mantenimiento] Limpieza #%d finalizada.\n", corrida)
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