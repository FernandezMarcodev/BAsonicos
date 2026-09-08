package handlers

import (
	"net/http"
	"time"

	"bassonicos/internal/config"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	Pool *pgxpool.Pool
	Cfg  config.Config
}

func New(pool *pgxpool.Pool, cfg config.Config) *App {
	return &App{Pool: pool, Cfg: cfg}
}

// Health replica el endpoint raíz del backend original.
func (a *App) Health(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte("<p>Api funcionando correctamente: 200 OK</p>"))
}

// HealthJSON endpoint para monitoreo (UptimeRobot, etc.) - devuelve JSON con estado.
func (a *App) HealthJSON(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"service":   "bassonicos-backend",
	})
}