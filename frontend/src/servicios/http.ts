export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export class ErrorApi extends Error {
  status: number

  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

export interface OpcionesPeticion {
  metodo?: string
  token?: string
  cuerpo?: unknown
}

export async function peticion<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opciones.token) headers.Authorization = `Bearer ${opciones.token}`
  if (opciones.cuerpo !== undefined) headers['Content-Type'] = 'application/json'

  const respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers,
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  })

  if (!respuesta.ok) {
    let mensaje = 'Error en la petición'
    try {
      const datos = (await respuesta.json()) as { error?: string }
      if (typeof datos?.error === 'string') mensaje = datos.error
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ErrorApi(respuesta.status, mensaje)
  }

  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}