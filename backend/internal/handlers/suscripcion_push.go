package handlers

import (
	"net/http"

	mid "bassonicos/internal/middleware"
	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

type cuerpoSuscripcionPush struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

// ClaveVapid: GET /clave_vapid (público). Devuelve la clave pública VAPID para
// que el frontend pueda suscribirse (activo=false si el push no está configurado).
func (a *App) ClaveVapid(c *gin.Context) {
	if !services.VapidActivo(a.Cfg) {
		c.JSON(http.StatusOK, gin.H{"activo": false, "clave_publica": ""})
		return
	}
	c.JSON(http.StatusOK, gin.H{"activo": true, "clave_publica": a.Cfg.VAPIDPublicKey})
}

// PostSuscripcionPush: POST /suscripcion_push (protegido). Guarda o actualiza la
// suscripción push del navegador del usuario. Devuelve 204.
func (a *App) PostSuscripcionPush(c *gin.Context) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	if !services.VapidActivo(a.Cfg) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Las notificaciones push no están configuradas"})
		return
	}

	var cuerpo cuerpoSuscripcionPush
	if err := c.ShouldBindJSON(&cuerpo); err != nil ||
		cuerpo.Endpoint == "" || cuerpo.Keys.P256dh == "" || cuerpo.Keys.Auth == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La suscripción está incompleta"})
		return
	}

	if err := services.GuardarSuscripcionPush(
		c.Request.Context(), a.Pool, userID,
		cuerpo.Endpoint, cuerpo.Keys.P256dh, cuerpo.Keys.Auth, c.Request.UserAgent(),
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo guardar la suscripción"})
		return
	}

	c.Status(http.StatusNoContent)
}

// DeleteSuscripcionPush: DELETE /suscripcion_push (protegido). Quita la
// suscripción push (desactivar notificaciones). Devuelve 204, idempotente.
func (a *App) DeleteSuscripcionPush(c *gin.Context) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	var cuerpo cuerpoSuscripcionPush
	if err := c.ShouldBindJSON(&cuerpo); err != nil || cuerpo.Endpoint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Falta el endpoint de la suscripción"})
		return
	}

	if err := services.EliminarSuscripcionPush(
		c.Request.Context(), a.Pool, userID, cuerpo.Endpoint,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo quitar la suscripción"})
		return
	}

	c.Status(http.StatusNoContent)
}