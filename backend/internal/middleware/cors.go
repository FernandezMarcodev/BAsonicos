package middleware

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS devuelve un middleware con orígenes restringidos. Si origenos está vacío
// (dev), se permiten los orígenes dev habituales (localhost). En producción debe
// definirse CORS_ORIGINS con la lista de dominios permitidos.
func CORS(origenos []string) gin.HandlerFunc {
	permitidos := map[string]bool{}
	for _, o := range origenos {
		permitidos[o] = true
	}

	return cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			// Sin restricciones explicitas: permitido solo si es un origen dev.
			if len(permitidos) == 0 {
				return strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1")
			}
			return permitidos[origin]
		},
		AllowMethods:  []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders: []string{"Content-Length"},
		MaxAge:        12 * time.Hour,
	})
}