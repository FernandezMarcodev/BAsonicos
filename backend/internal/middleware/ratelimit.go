package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type contadorIP struct {
	cuenta   int
	primeraLlamada time.Time
}

// RateLimit limita a maxPeticiones por ventana para cada IP. Es un limitador en
// memoria (por proceso), suficiente a escala de este proyecto y sin dependencias.
// Devuelve 429 si la IP supera el tope en la ventana.
func RateLimit(maxPeticiones int, ventana time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	byIP := make(map[string]*contadorIP)

	return func(c *gin.Context) {
		ip := c.ClientIP()

		mu.Lock()
		ctr, ok := byIP[ip]
		now := time.Now()
		if !ok || now.Sub(ctr.primeraLlamada) >= ventana {
			ctr = &contadorIP{cuenta: 1, primeraLlamada: now}
			byIP[ip] = ctr
		} else {
			ctr.cuenta++
		}

		// Poda ocasional para no acumular IPs muertas.
		if len(byIP) > 2048 {
			for ip2, ctr2 := range byIP {
				if now.Sub(ctr2.primeraLlamada) >= 2*ventana {
					delete(byIP, ip2)
				}
			}
		}

		excede := ctr.cuenta > maxPeticiones
		mu.Unlock()

		if excede {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Demasiadas solicitudes, intentá más tarde"})
			return
		}
		c.Next()
	}
}