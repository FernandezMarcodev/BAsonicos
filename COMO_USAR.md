# Cómo usar BAsónicos

BAsónicos te muestra los conciertos más destacados de Buenos Aires y alrededores en
un mapa interactivo. Podés explorar, filtrar, guardar favoritos y comprar entradas. Esta
guía también está disponible dentro de la app en la página **Cómo usar** (ruta `/ayuda`,
componente `frontend/src/paginas/Ayuda.tsx`).

---

## 1. Explorar el mapa

- Cada concierto se muestra como un **marcador** en el mapa.
- Tocá un marcador para ver el detalle del evento (fecha, hora, lugar, disponibilidad).
- En pantallas chicas alternás entre **Mapa** y **Lista** con el control segmentado
  sobre los resultados; en pantallas grandes se ven ambos a la vez.

## 2. Buscar por artista

- En el panel de filtros escribí el nombre de un artista en el buscador y elegí la
  coincidencia de las **sugerencias** (podés navegarlas con las flechas `↑`/`↓` y `Enter`,
  y cerrar con `Esc`).
- El mapa y la lista se filtran al instante. Si dejás el buscador vacío, se muestran todos.

## 3. Conciertos cerca de tu ubicación

- Activá el botón **"Cerca de mí"** y elegí un **radio** (1 a 50 km) con el deslizador.
- Solo se muestran los conciertos dentro de ese radio, calculado como distancia en línea
  recta (fórmula del haverseno).

> Nota: se usa la **ubicación del navegador**. Si el navegador no la permite, el filtro
> queda deshabilitado y ves todos los conciertos.

## 4. Crear una cuenta

- Registrate con nombre, correo y contraseña (**mínimo 8 caracteres** con al menos una
  **mayúscula**, una **minúscula**, un **número** y un **carácter especial**).
- El correo debe ser único. Si ya existe una cuenta, la app te lo avisa.
- La sesión se mantiene abierta aunque cierres el navegador.

## 5. Guardar favoritos

- Tocá el **corazón** de una tarjeta para guardar el concierto.
- El corazón se rellena y pasa a color rojo cuando está guardado.
- Para ver solo tus favoritos, usá el filtro **"Mis favoritos"**.
- Si no tenés sesión, al tocar el corazón la app te lleva a **Ingresar**.

## 6. Precios y entradas

- Cada tarjeta indica si el evento está **agotado** o **disponible**.
- **Entradas**: va a la página oficial del evento.
- **Cómo llegar**: abre Google Maps con el lugar del evento.
- **Ver en mapa**: centra el mapa en el evento (solo si el lugar tiene coordenadas).

## 7. Seguir artistas y recibir novedades

- Tocá **"Seguir"** en cualquier tarjeta para seguir a su artista (el botón pasa a
  **"Siguiendo"**; tocándolo de nuevo lo dejás de seguir).
- En el segmento **"Siguiendo"** ves las tarjetas de los artistas que seguís, además de
  "Todos los conciertos" y "Mis favoritos".
- Cuando un artista seguido sume fechas nuevas, la **campana** de la barra superior
  muestra el conteo de novedades. Tocá una novedad para verla en el mapa y
  **"Marcar todas como leídas"** para limpiar el contador.
- Necesitás una cuenta para seguir artistas (te lleva a Ingresar si no tenés sesión).

## 8. Modo oscuro

- Con el botón de **luna/sol** en la barra superior cambiás el tema.
- La preferencia queda recordada para la próxima visita.
- Dentro del mapa el control superior derecho elige el estilo: automático (sigue tu
  tema), claro u oscuro.

## 9. Solución de problemas

| Problema | Solución |
| --- | --- |
| No se cargan los conciertos | Revisá que la API esté corriendo en `http://localhost:5000` (`GET /conciertos`). |
| Ubicación no disponible | El navegador la bloqueó; usá el filtro por artista o revisá los permisos. |
| "Ya existe una cuenta" | Usá "Ingresar" en lugar de "Crear cuenta". |
| La campana no muestra novedades | Las novedades llegan cuando el scraper ingresa fechas nuevas de artistas que seguís; revisá el segmento "Siguiendo". |

> Los datos provienen de **agendade.com.ar**, acreditado en el pie de página.