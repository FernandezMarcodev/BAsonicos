package models

import "time"

// Coordenadas en la API se devuelven como [lng, lat], igual que el backend Flask.
type Coordenadas [2]float64

type UbicacionDetalle struct {
	ID             int         `json:"id"`
	Nombre         string      `json:"nombre"`
	CapacidadTotal int         `json:"capacidad_total"`
	Coordenadas    *Coordenadas `json:"coordenadas"`
	URLMaps        *string     `json:"url_maps"`
}

type Concierto struct {
	ID               int              `json:"id"`
	Nombre           string           `json:"nombre"`
	Artista          string           `json:"artista"`
	URLEvento        *string          `json:"url_evento"`
	Ubicacion        *int             `json:"ubicacion"`
	IsAgotado        bool             `json:"isAgotado"`
	IsAptoMenores    bool             `json:"isAptoMenores"`
	Fecha            *string          `json:"fecha"`
	Hora             *string          `json:"hora"`
	UbicacionDetalle *UbicacionDetalle `json:"ubicacion_detalle"`
}

type Usuario struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	Nombre       string    `json:"nombre"`
	PasswordHash string    `json:"-"`
	CreadoEn     time.Time `json:"creado_en"`
}

type RespuestaAuth struct {
	Token   string  `json:"token"`
	Usuario Usuario `json:"usuario"`
}

// Notificacion describe el aviso de un concierto nuevo de un artista seguido.
type Notificacion struct {
	ID        int       `json:"id"`
	Leida     bool      `json:"leida"`
	CreadoEn  time.Time `json:"creado_en"`
	Concierto Concierto `json:"concierto"`
}