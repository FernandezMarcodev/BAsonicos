package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode"

	"bassonicos/internal/models"
	"bassonicos/internal/services"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func normEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func trim(s string) string {
	return strings.TrimSpace(s)
}

const (
	lenMinPassword = 8
	lenMaxPassword = 72 // límite de bcrypt (72 bytes)
)

// debilidadesPassword devuelve las reglas de complejidad que la contraseña no
// cumple. Si supera el máximo de bcrypt, solo se indica ese incumplimiento.
func debilidadesPassword(password string) []string {
	if len(password) > lenMaxPassword {
		return []string{fmt.Sprintf("no superar los %d caracteres", lenMaxPassword)}
	}

	debilidades := make([]string, 0)
	if len(password) < lenMinPassword {
		debilidades = append(debilidades, fmt.Sprintf("tener al menos %d caracteres", lenMinPassword))
	}

	var tieneMayuscula, tieneMinuscula, tieneDigito, tieneEspecial bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			tieneMayuscula = true
		case unicode.IsLower(r):
			tieneMinuscula = true
		case unicode.IsDigit(r):
			tieneDigito = true
		case unicode.IsLetter(r) || r == ' ':
			// Letra sin variante de caja o espacio: no cuenta como especial.
		default:
			tieneEspecial = true
		}
	}
	if !tieneMayuscula {
		debilidades = append(debilidades, "incluir una letra mayúscula")
	}
	if !tieneMinuscula {
		debilidades = append(debilidades, "incluir una letra minúscula")
	}
	if !tieneDigito {
		debilidades = append(debilidades, "incluir un número")
	}
	if !tieneEspecial {
		debilidades = append(debilidades, "incluir un carácter especial")
	}

	return debilidades
}

func validarRegistro(email, nombre, password string) string {
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return "Email inválido"
	}
	if len(email) > 255 {
		return "Email demasiado largo"
	}
	if nombre == "" {
		return "El nombre es obligatorio"
	}
	if len(nombre) > 80 {
		return "Nombre demasiado largo"
	}
	if debilidades := debilidadesPassword(password); len(debilidades) > 0 {
		return "La contraseña debe " + strings.Join(debilidades, ", ")
	}
	return ""
}

// crearUsuario inserta el usuario y devuelve la fila creada. Ante email duplicado
// responde 409 (CONFLICT), como se acordó en el plan.
func (a *App) crearUsuario(ctx context.Context, email, nombre, password string) (models.Usuario, error, int) {
	hash, err := services.HashPassword(password)
	if err != nil {
		return models.Usuario{}, errors.New("No se pudo crear el usuario"), http.StatusInternalServerError
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var u models.Usuario
	err = a.Pool.QueryRow(ctx,
		`INSERT INTO usuarios (email, nombre, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, nombre, password_hash, creado_en`,
		email, nombre, hash,
	).Scan(&u.ID, &u.Email, &u.Nombre, &u.PasswordHash, &u.CreadoEn)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return models.Usuario{}, errors.New("Ya existe una cuenta con ese email"), http.StatusConflict
		}
		return models.Usuario{}, errors.New("No se pudo crear el usuario"), http.StatusInternalServerError
	}
	return u, nil, http.StatusOK
}

// obtenerUsuarioPorEmail devuelve el usuario por email (normalizado a minúsculas).
func (a *App) obtenerUsuarioPorEmail(ctx context.Context, email string) (models.Usuario, error) {
	var u models.Usuario
	err := a.Pool.QueryRow(ctx,
		`SELECT id, email, nombre, password_hash, creado_en FROM usuarios WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Nombre, &u.PasswordHash, &u.CreadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Usuario{}, pgx.ErrNoRows
	}
	return u, err
}

// obtenerUsuarioPorID devuelve el usuario por su id (usado por /me).
func (a *App) obtenerUsuarioPorID(ctx context.Context, id int) (models.Usuario, error) {
	var u models.Usuario
	err := a.Pool.QueryRow(ctx,
		`SELECT id, email, nombre, password_hash, creado_en FROM usuarios WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Nombre, &u.PasswordHash, &u.CreadoEn)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Usuario{}, pgx.ErrNoRows
	}
	return u, err
}