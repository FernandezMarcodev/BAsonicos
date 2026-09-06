package handlers

import (
	"net/http"

	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

// ScrapeConciertos: GET /scrape_conciertos_agendade
// Dispara el script Python de scrapeo (protegido por middleware.Admin + rate-limit).
// Tras un scrapeo exitoso registra las notificaciones de conciertos nuevos para
// artistas seguidos.
func (a *App) ScrapeConciertos(c *gin.Context) {
	res, err := services.EjecutarScraperYRegistrarNovedades(c.Request.Context(), a.Cfg, a.Pool, "scrape")
	if err != nil {
		// No exponer el error interno (paths, DSN, stack traces) hacia el cliente.
		c.Error(err) // queda registrado en el log del servidor por gin.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "El scrapeo falló, revisá los registros del servidor"})
		return
	}
	msg := "Scrapeo completado"
	if !res.Exitoso {
		msg = "Scrapeo finalizó con salida no exitosa"
	}
	c.JSON(http.StatusOK, gin.H{"mensaje": msg})
}