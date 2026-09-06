package handlers

import (
	"net/http"
	"strconv"

	mid "bassonicos/internal/middleware"
	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

// GetFavoritos: GET /favoritos (protegido). Lista los conciertos favoritos del usuario.
func (a *App) GetFavoritos(c *gin.Context) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	conciertos, err := services.ListarFavoritos(c.Request.Context(), a.Pool, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron listar los favoritos"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"favoritos": conciertos})
}

// PostFavorito: POST /favoritos/:conciertoId (protegido). 201 o 404 si el concierto no existe.
func (a *App) PostFavorito(c *gin.Context) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	conciertoID, err := strconv.Atoi(c.Param("conciertoId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identificador de concierto inválido"})
		return
	}

	existe, err := services.ExisteConcierto(c.Request.Context(), a.Pool, conciertoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo verificar el concierto"})
		return
	}
	if !existe {
		c.JSON(http.StatusNotFound, gin.H{"error": "El concierto no existe"})
		return
	}

	if err := services.AgregarFavorito(c.Request.Context(), a.Pool, userID, conciertoID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo guardar el favorito"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"exito": true})
}

// DeleteFavorito: DELETE /favoritos/:conciertoId (protegido). 204, idempotente.
func (a *App) DeleteFavorito(c *gin.Context) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	conciertoID, err := strconv.Atoi(c.Param("conciertoId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identificador de concierto inválido"})
		return
	}

	if err := services.EliminarFavorito(c.Request.Context(), a.Pool, userID, conciertoID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo quitar el favorito"})
		return
	}

	c.Status(http.StatusNoContent)
}