package handlers

import (
	"fmt"
	"net/http"

	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

// GetConciertos: GET /conciertos
func (a *App) GetConciertos(c *gin.Context) {
	conciertos, err := services.GetConciertos(c.Request.Context(), a.Pool)
	if err != nil {
		fmt.Printf("Error en la consulta de conciertos: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error en la consulta"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conciertos": conciertos})
}