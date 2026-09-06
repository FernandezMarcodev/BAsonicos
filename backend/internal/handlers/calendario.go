package handlers

import (
	"net/http"

	mid "bassonicos/internal/middleware"
	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

// CalendarioConciertos: GET /conciertos.ics (público). Exporta todos los
// conciertos a Google Calendar / apps de calendario.
func (a *App) CalendarioConciertos(c *gin.Context) {
	conciertos, err := services.GetConciertos(c.Request.Context(), a.Pool)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo generar el calendario"})
		return
	}

	ics := services.GenerarCalendarioICS(conciertos, "Conciertos de BAsónicos", a.Cfg.SitioWeb)
	c.Header("Content-Type", "text/calendar; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="bassonicos-conciertos.ics"`)
	c.String(http.StatusOK, "%s", ics)
}

// CalendarioFavoritos: GET /favoritos.ics (protegido). Exporta los favoritos
// del usuario al calendario.
func (a *App) CalendarioFavoritos(c *gin.Context) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	conciertos, err := services.ListarFavoritos(c.Request.Context(), a.Pool, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo generar el calendario"})
		return
	}

	ics := services.GenerarCalendarioICS(conciertos, "Mis favoritos en BAsónicos", a.Cfg.SitioWeb)
	c.Header("Content-Type", "text/calendar; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="bassonicos-favoritos.ics"`)
	c.String(http.StatusOK, "%s", ics)
}