package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Admin valida el token de administración para endpoints sensibles
// (por ejemplo el scrapeo manual). El token se envía en el header X-Admin-Token.
// Si el token no está configurado en el servidor, el endpoint queda inhabilitado.
func Admin(token string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if token == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Endpoint fuera de servicio"})
			return
		}
		if c.GetHeader("X-Admin-Token") != token {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Token de administración inválido"})
			return
		}
		c.Next()
	}
}