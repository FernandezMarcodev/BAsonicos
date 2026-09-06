# Funcionalidades futuras

Documentación de funcionalidades planificadas que se implementarán en una **rama
separada**. El objetivo es que cada feature tenga su propio PR revisable y no mezcle
cambios con la app actual.

---

## ✅ Seguir artistas y notificar conciertos nuevos (implementado)

**Estado:** completo en la rama `SeguirArtistas`. Tablas `seguidos` y `notificaciones`,
servicios y handlers en `backend/internal`, botón "Seguir", segmento "Siguiendo", campana
de novedades y buscador de artista con sugerencias en el frontend.

### Criterios de aceptación (cumplidos)

- [x] Al seguir un artista, los conciertos nuevos de ese artista generan una notificación.
- [x] El usuario no ve notificaciones de artistas que no sigue.
- [x] Las notificaciones se marcan leídas correctamente.
- [x] El proceso corre sin duplicar notificaciones si se ejecuta dos veces seguidas.

### Cómo funciona

- Botón **"Seguir"/"Siguiendo"** en cada tarjeta; listado propio en el segmento
  **"Siguiendo"** del inicio.
- El scraper calcula una clave estable por evento (`artista|fecha|hora|lugar`); el job
  posterior (`RegistrarNovedades`) inserta una notificación por usuario que sigue al
  artista del concierto recién insertado, de forma idempotente.

---

## Chips de filtros activos

Al definir filtros (artista, radio, ubicación), mostrar **chips removibles** sobre los
resultados con un resumen ("Artista: Coldplay ×", "12 km") para que el usuario entienda y
limpie la selección sin abrir el panel.

## Novedades por email / push

Enviar un resumen diario por email (o notificaciones push) cuando haya novedades de
artistas seguidos, además de la campana in-app. Requiere un servicio de email (p. ej.
Resend/SendGrid) y una columna de preferencia en `usuarios`.

## Convertir favoritos en seguidos y viceversa

Al guardar un favorito de un artista muchas veces, poder "convertirlo" en seguimiento del
propio artista con un solo toque (detectar por artista: si el usuario guardó 2+ favoritos
de un mismo artista, ofrecer "Seguir a {artista}").

---

### Otras ideas descartadas por ahora

- Compartir eventos por WhatsApp/redes (requiere la app desplegada con URL pública).
- Filtros combinados guardados ("alertas" por artista + ciudad + rango de precio).
- Calendario `/ical` para exportar eventos a Google Calendar.