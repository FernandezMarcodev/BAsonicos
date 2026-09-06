package handlers

import (
	"net/http"

	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

// ScrapeConciertos: GET /scrape_conciertos_agendade
// Dispara el script Python de scrapeo (público y automático, igual que en el
// sistema original; no tiene relación con el registro/login). Tras un scrapeo
// exitoso registra las notificaciones de conciertos nuevos para artistas seguidos.
func (a *App) ScrapeConciertos(c *gin.Context) {
	res, err := services.EjecutarScraperYRegistrarNovedades(c.Request.Context(), a.Cfg, a.Pool, "scrape")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"error": err.Error(), "mensaje": "El scrapeo falló, revisá el log"})
		return
	}
	msg := "Scrapeo completado"
	if !res.Exitoso {
		msg = "Scrapeo finalizó con salida no exitosa"
	}
	c.JSON(http.StatusOK, gin.H{"mensaje": msg, "log": res.Log})
}