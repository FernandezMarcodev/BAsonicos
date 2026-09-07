package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBSSLMode  string

	Port string
	Host string

	ScraperIntervaloMinutos int
	KeepAliveURL            string

	JWTSecret string

	// CORSOrigins lista separada por comas de orígenes permitidos para CORS.
	// Vacío en dev permite localhost; en producción debe configurarse.
	CORSOrigins []string

	PythonCmd    string
	ScraperPath  string
	ScraperRunDir string

	// Notificaciones push (Web Push con VAPID).
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string

	// SitioWeb es la URL pública del frontend (para enlaces en push e ics).
	SitioWeb string
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// parseCSV parte una lista separada por comas y la limpia (quita espacios y vacíos).
func parseCSV(s string) []string {
	if s == "" {
		return nil
	}
	partes := strings.Split(s, ",")
	limpias := make([]string, 0, len(partes))
	for _, p := range partes {
		if t := strings.TrimSpace(p); t != "" {
			limpias = append(limpias, t)
		}
	}
	return limpias
}

func Load() (Config, error) {
	_ = godotenv.Load()

	intervalo, err := strconv.Atoi(getenv("SCRAPER_INTERVALO_MINUTOS", "1440"))
	if err != nil {
		fmt.Println("AVISO: SCRAPER_INTERVALO_MINUTOS inválido, se usa 1440.")
		intervalo = 1440
	}

	cfg := Config{
		DBHost:                  getenv("DB_HOST", "localhost"),
		DBPort:                  getenv("DB_PORT", "5432"),
		DBName:                  getenv("DB_NAME", "conciertos"),
		DBUser:                  getenv("DB_USER", "conciertos"),
		DBPassword:              getenv("DB_PASSWORD", "conciertos_dev"),
		DBSSLMode:               getenv("DB_SSLMODE", ""),
		Port:                    getenv("PORT", "5000"),
		Host:                    getenv("HOST", "0.0.0.0"),
		ScraperIntervaloMinutos: intervalo,
		KeepAliveURL:            getenv("KEEP_ALIVE_URL", ""),
		JWTSecret:               getenv("JWT_SECRET", ""),
		PythonCmd:               getenv("PYTHON_CMD", "python"),
		ScraperPath:             getenv("SCRAPER_PATH", "../scraper/scraper.py"),
		ScraperRunDir:           getenv("SCRAPER_RUN_DIR", "."),
	}

	// El JWT_SECRET es obligatorio. Para no subir con un secreto hardcodeado
	// que permita forjar tokens, si falta se devuelve un error de configuración.
	// La presencia de DB_SSLMODE indica un entorno remoto/producción; en ese caso,
	// un secreto ausente es un fallo fatal (no un aviso).
	if cfg.JWTSecret == "" {
		if cfg.DBSSLMode != "" {
			return cfg, fmt.Errorf("JWT_SECRET es obligatorio en producción (definirlo en backend/.env o en el entorno)")
		}
		cfg.JWTSecret = "desarrollo_secreto_inseguro_cambiar"
		fmt.Println("AVISO: JWT_SECRET no definido, se usa un secreto de desarrollo (definirlo para producción).")
	}

	cfg.CORSOrigins = parseCSV(getenv("CORS_ORIGINS", ""))

	cfg.VAPIDPublicKey = getenv("VAPID_PUBLIC_KEY", "")
	cfg.VAPIDPrivateKey = getenv("VAPID_PRIVATE_KEY", "")
	cfg.VAPIDSubject = getenv("VAPID_SUBJECT", "mailto:soporte@bassonicos.com")
	cfg.SitioWeb = getenv("SITIO_WEB", "http://localhost")

	if cfg.VAPIDPublicKey == "" || cfg.VAPIDPrivateKey == "" {
		fmt.Println("AVISO: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no definidos, las notificaciones push quedarán desactivadas.")
	}

	return cfg, nil
}