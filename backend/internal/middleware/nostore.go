package middleware

import "github.com/gin-gonic/gin"

// NoStore agrega Cache-Control: no-store, máx-age=0 a todas las respuestas,
// replicando el decorador @app.after_request del backend original.
func NoStore() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store, max-age=0")
		c.Next()
	}
}