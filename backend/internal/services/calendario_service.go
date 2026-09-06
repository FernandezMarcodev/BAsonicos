package services

import (
	"fmt"
	"strings"
	"time"

	"bassonicos/internal/models"
)

const zonaHoraria = "America/Argentina/Buenos_Aires"

// escaparICS escapa los caracteres reservados del RFC 5545.
func escaparICS(texto string) string {
	reemplazos := strings.NewReplacer(
		"\\", "\\\\",
		"\n", "\\n",
		",", "\\,",
		";", "\\;",
	)
	return reemplazos.Replace(texto)
}

// fechaICS devuelve el DTSTART del evento. Sin hora → evento de día completo
// (VALUE=DATE); con hora → ica local con TZID (sin sufijo Z).
func fechaICS(fecha, hora string) string {
	fecha = strings.TrimSpace(fecha)
	if fecha == "" {
		return ""
	}
	fechaCompacta := strings.ReplaceAll(fecha, "-", "")
	if hora == "" || len(hora) < 5 {
		return fmt.Sprintf(";VALUE=DATE:%s", fechaCompacta)
	}
	horaCompacta := strings.ReplaceAll(hora[:5], ":", "")
	return fmt.Sprintf(";TZID=%s:%sT%s00", zonaHoraria, fechaCompacta, horaCompacta)
}

func dtstampICS() string {
	return time.Now().UTC().Format("20060102T150405Z")
}

// GenerarCalendarioICS arma el feed .ics de un listado de conciertos (RFC 5545).
func GenerarCalendarioICS(conciertos []models.Concierto, titulo, sitioWeb string) string {
	var b strings.Builder

	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//BAsónicos//BAsónicos 1.0//ES\r\n")
	b.WriteString("CALSCALE:GREGORIAN\r\n")
	b.WriteString("METHOD:PUBLISH\r\n")
	b.WriteString(fmt.Sprintf("X-WR-CALNAME:%s\r\n", escaparICS(titulo)))
	b.WriteString(fmt.Sprintf("X-WR-TIMEZONE:%s\r\n", zonaHoraria))

	dtstamp := dtstampICS()
	for _, concierto := range conciertos {
		var fecha, hora string
		if concierto.Fecha != nil {
			fecha = *concierto.Fecha
		}
		if concierto.Hora != nil {
			hora = *concierto.Hora
		}
		start := fechaICS(fecha, hora)
		if start == "" {
			continue
		}
		resumen := concierto.Nombre
		if concierto.Artista != "" && !strings.Contains(strings.ToLower(resumen), strings.ToLower(concierto.Artista)) {
			resumen = concierto.Artista + ": " + resumen
		}

		b.WriteString("BEGIN:VEVENT\r\n")
		fmt.Fprintf(&b, "UID:concierto-%d@%s\r\n", concierto.ID, strings.TrimPrefix(sitioWeb, "https://"))
		fmt.Fprintf(&b, "DTSTAMP:%s\r\n", dtstamp)
		fmt.Fprintf(&b, "DTSTART%s\r\n", start)

		descripcion := "Concierto de " + concierto.Artista
		if concierto.UbicacionDetalle != nil && concierto.UbicacionDetalle.Nombre != "" {
			fmt.Fprintf(&b, "LOCATION:%s\r\n", escaparICS(concierto.UbicacionDetalle.Nombre))
			descripcion += " en " + concierto.UbicacionDetalle.Nombre
		}
		if concierto.IsAgotado {
			descripcion += ". Entradas agotadas."
		} else {
			descripcion += ". Entradas disponibles."
		}
		if concierto.URLEvento != nil && *concierto.URLEvento != "" {
			descripcion += " Entradas: " + *concierto.URLEvento
			fmt.Fprintf(&b, "URL:%s\r\n", escaparICS(*concierto.URLEvento))
		}
		fmt.Fprintf(&b, "SUMMARY:%s\r\n", escaparICS(resumen))
		fmt.Fprintf(&b, "DESCRIPTION:%s\r\n", escaparICS(descripcion))
		b.WriteString("END:VEVENT\r\n")
	}

	b.WriteString("END:VCALENDAR\r\n")
	return b.String()
}