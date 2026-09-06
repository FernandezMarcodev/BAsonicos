package handlers

import (
	"net/http"
	"strconv"
	"strings"

	mid "bassonicos/internal/middleware"
	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

func usuarioIDGuard(c *gin.Context) (int, bool) {
	userID, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return 0, false
	}
	return userID, true
}

// GetSeguidos: GET /seguidos (protegido). Lista los artistas que sigue el usuario.
func (a *App) GetSeguidos(c *gin.Context) {
	userID, ok := usuarioIDGuard(c)
	if !ok {
		return
	}

	seguidos, err := services.ListarSeguidos(c.Request.Context(), a.Pool, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron listar los artistas seguidos"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"seguidos": seguidos})
}

// PostSeguido: POST /seguidos (protegido). 201, o 404 si el artista no tiene
// conciertos en la base, o 400 si el nombre es inválido.
func (a *App) PostSeguido(c *gin.Context) {
	userID, ok := usuarioIDGuard(c)
	if !ok {
		return
	}

	var cuerpo struct {
		Artista string `json:"artista"`
	}
	if err := c.ShouldBindJSON(&cuerpo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cuerpo inválido"})
		return
	}

	artista := strings.TrimSpace(cuerpo.Artista)
	if artista == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El artista es obligatorio"})
		return
	}
	if len(artista) > 80 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El nombre del artista es demasiado largo"})
		return
	}

	existe, err := services.ExisteArtista(c.Request.Context(), a.Pool, artista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo verificar el artista"})
		return
	}
	if !existe {
		c.JSON(http.StatusNotFound, gin.H{"error": "El artista no tiene conciertos cargados"})
		return
	}

	if err := services.SeguirArtista(c.Request.Context(), a.Pool, userID, artista); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo seguir al artista"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"exito": true})
}

// DeleteSeguido: DELETE /seguidos/:artista (protegido). 204, idempotente.
func (a *App) DeleteSeguido(c *gin.Context) {
	userID, ok := usuarioIDGuard(c)
	if !ok {
		return
	}

	artista := strings.TrimSpace(c.Param("artista"))
	if artista == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El artista es obligatorio"})
		return
	}

	if err := services.DejarDeSeguir(c.Request.Context(), a.Pool, userID, artista); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo dejar de seguir al artista"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetNovedades: GET /novedades (protegido). Devuelve el conteo de no leídas y la
// lista completa de notificaciones del usuario.
func (a *App) GetNovedades(c *gin.Context) {
	userID, ok := usuarioIDGuard(c)
	if !ok {
		return
	}

	noLeidas, notificaciones, err := services.ListarNotificaciones(c.Request.Context(), a.Pool, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron listar las novedades"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"no_leidas": noLeidas, "notificaciones": notificaciones})
}

// MarcarNovedadLeida: POST /novedades/:id/leida (protegido). 200, idempotente.
func (a *App) MarcarNovedadLeida(c *gin.Context) {
	userID, ok := usuarioIDGuard(c)
	if !ok {
		return
	}

	notifID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identificador de novedad inválido"})
		return
	}

	if err := services.MarcarLeida(c.Request.Context(), a.Pool, userID, notifID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo marcar la novedad"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"exito": true})
}

// MarcarTodasNovedadesLeidas: POST /novedades/leer_todas (protegido). 200, idempotente.
func (a *App) MarcarTodasNovedadesLeidas(c *gin.Context) {
	userID, ok := usuarioIDGuard(c)
	if !ok {
		return
	}

	if err := services.MarcarTodasLeidas(c.Request.Context(), a.Pool, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudieron marcar las novedades"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"exito": true})
}