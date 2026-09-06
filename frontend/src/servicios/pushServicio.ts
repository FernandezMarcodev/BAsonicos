import { peticion } from './http'

export interface InfoVapid {
  activo: boolean
  clave_publica: string
}

function base64urlABytes(valor: string): Uint8Array {
  const base64 = valor
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(valor.length / 4) * 4, '=')
  const binaria = atob(base64)
  return Uint8Array.from(binaria, (caracter) => caracter.charCodeAt(0))
}

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binaria = ''
  bytes.forEach((valor) => {
    binaria += String.fromCharCode(valor)
  })
  return btoa(binaria).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function obtenerInfoVapid(): Promise<InfoVapid> {
  try {
    return await peticion<InfoVapid>('/clave_vapid')
  } catch {
    return { activo: false, clave_publica: '' }
  }
}

export function pushSoportado(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js')
}

export async function obtenerSuscripcionActiva(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    return registro ? await registro.pushManager.getSubscription() : null
  } catch {
    return null
  }
}

export async function suscribirPush(clavePublicaVapid: string): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null

  const registro = await registrarServiceWorker()
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return null

  const clave = base64urlABytes(clavePublicaVapid)
  return registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: clave,
  })
}

export async function guardarSuscripcion(token: string, suscripcion: PushSubscription): Promise<void> {
  const p256dh = suscripcion.getKey('p256dh')
  const auth = suscripcion.getKey('auth')
  if (!p256dh || !auth) {
    throw new Error('La suscripción no tiene claves de cifrado')
  }

  await peticion('/suscripcion_push', {
    metodo: 'POST',
    token,
    cuerpo: {
      endpoint: suscripcion.endpoint,
      keys: {
        p256dh: base64url(p256dh),
        auth: base64url(auth),
      },
    },
  })
}

export async function quitarSuscripcion(token: string, endpoint: string): Promise<void> {
  await peticion('/suscripcion_push', {
    metodo: 'DELETE',
    token,
    cuerpo: { endpoint },
  })
}

export async function desuscribir(token: string): Promise<void> {
  const suscripcion = await obtenerSuscripcionActiva()
  if (!suscripcion) return
  await quitarSuscripcion(token, suscripcion.endpoint).catch(() => {
    /* el backend puede no tenerla registrada */
  })
  await suscripcion.unsubscribe().catch(() => {
    /* la suscripción pudo vencerse */
  })
}