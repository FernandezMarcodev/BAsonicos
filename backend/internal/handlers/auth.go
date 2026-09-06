package handlers

import (
	"net/http"

	mid "bassonicos/internal/middleware"
	"bassonicos/internal/models"
	"bassonicos/internal/services"

	"github.com/gin-gonic/gin"
)

// Registro: POST /registro  { "email": "...", "nombre": "...", "password": "..." }
func (a *App) Registro(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Nombre   string `json:"nombre"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cuerpo de solicitud inválido"})
		return
	}

	req.Email = normEmail(req.Email)
	req.Nombre = trim(req.Nombre)

	if msg := validarRegistro(req.Email, req.Nombre, req.Password); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	usuario, err, status := a.crearUsuario(c, req.Email, req.Nombre, req.Password)
	if err != nil {
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	token, err := services.GenerarToken(a.Cfg, usuario)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo generar la sesión"})
		return
	}

	c.JSON(http.StatusCreated, models.RespuestaAuth{Token: token, Usuario: usuario})
}

// Login: POST /login  { "email": "...", "password": "..." }
func (a *App) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cuerpo de solicitud inválido"})
		return
	}

	usuario, err := a.obtenerUsuarioPorEmail(c, normEmail(req.Email))
	if err != nil {
		// Usuario inexistente: aun así corremos bcrypt contra un hash dummy para
		// no revelar por tiempo de respuesta si un email está o no registrado.
		services.VerificarPassword(services.HashDummy, req.Password)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email o contraseña incorrectos"})
		return
	}
	if !services.VerificarPassword(usuario.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email o contraseña incorrectos"})
		return
	}

	token, err := services.GenerarToken(a.Cfg, usuario)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se pudo generar la sesión"})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaAuth{Token: token, Usuario: usuario})
}

// Me: GET /me (protegido con JWT). Devuelve el perfil simple del usuario.
func (a *App) Me(c *gin.Context) {
	id, err := mid.UsuarioID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token inválido"})
		return
	}

	usuario, err := a.obtenerUsuarioPorID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, usuario)
}