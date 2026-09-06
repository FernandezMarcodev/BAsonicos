package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

const ContextKeyUserID = "userID"

// UsuarioID devuelve el id del usuario autenticado guardado en el contexto.
func UsuarioID(c *gin.Context) (int, error) {
	return strconv.Atoi(c.GetString(ContextKeyUserID))
}

// Auth valida el token JWT (Authorization: Bearer <token>) y guarda el usuario
// en el contexto de gin. Sin token válido responde 401.
func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Se requiere autenticación"})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
			return
		}

		claims, err := services.ParseToken(secret, parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token inválido o expirado"})
			return
		}

		c.Set(ContextKeyUserID, claims.Subject)
		c.Next()
	}
}