package handlers

import (
	"net/http"

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