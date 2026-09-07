/* Service Worker de BAsónicos: shell offline + notificaciones push. */

const VERSION = 'bassonicos-v1'
const CACHE_APP = `${VERSION}-app`
const RECURSOS_SHELL = ['/', '/index.html', '/manifest.json', '/logo.svg', '/icon-192.png', '/icon-512.png']

const sinCache = async () => {
  const llaves = await caches.keys()
  await Promise.all(llaves.filter((llave) => !llave.startsWith(VERSION)).map((llave) => caches.delete(llave)))
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => cache.addAll(RECURSOS_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(sinCache().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (evento) => {
  const solicitud = evento.request
  if (solicitud.method !== 'GET') return

  const url = new URL(solicitud.url)
  // Solo se intercepta el propio origen: la API (API_BASE_URL) vive en otro origen.
  if (url.origin !== self.location.origin) return

  // Navegación: red primero; si no hay conexión, servimos el shell cacheado.
  if (solicitud.mode === 'navigate') {
    evento.respondWith(
      fetch(solicitud).catch(() => caches.match('/')),
    )
    return
  }

  // Assets (JS/CSS/imágenes): cache-first con revalidación en segundo plano.
  evento.respondWith(
    caches.match(solicitud).then((cacheado) => {
      const actualizacion = fetch(solicitud)
        .then((respuesta) => {
          if (respuesta && respuesta.status === 200) {
            const copia = respuesta.clone()
            caches.open(CACHE_APP).then((cache) => cache.put(solicitud, copia))
          }
          return respuesta
        })
        .catch(() => cacheado)
      return cacheado || actualizacion
    }),
  )
})

/* ===== Notificaciones push ===== */

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    /* payload no JSON */
  }

  const opciones = {
    body: datos.cuerpo || 'Tus artistas tienen conciertos nuevos.',
    icon: datos.icono || '/icon-192.png',
    badge: datos.badge || '/icon-192.png',
    data: { url: datos.url || '/' },
    tag: 'bassonicos-novedades',
    renotify: true,
  }

  evento.waitUntil(self.registration.showNotification(datos.titulo || 'BAsónicos', opciones))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = (evento.notification.data && evento.notification.data.url) || '/'

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if ('focus' in cliente) {
          cliente.navigate(destino)
          return cliente.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})