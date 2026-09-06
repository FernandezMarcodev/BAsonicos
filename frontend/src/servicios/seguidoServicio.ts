import { peticion } from './http'
import type { Notificacion, RespuestaNovedades, RespuestaSeguidos } from '../tipos'

export const seguidoServicio = {
  async obtenerSeguidos(token: string): Promise<string[]> {
    const datos = await peticion<RespuestaSeguidos>('/seguidos', { token })
    return Array.isArray(datos.seguidos) ? datos.seguidos : []
  },

  seguirArtista(artista: string, token: string): Promise<unknown> {
    return peticion('/seguidos', { token, metodo: 'POST', cuerpo: { artista } })
  },

  dejarDeSeguir(artista: string, token: string): Promise<unknown> {
    return peticion(`/seguidos/${encodeURIComponent(artista)}`, { token, metodo: 'DELETE' })
  },

  async obtenerNovedades(token: string): Promise<{ noLeidas: number; notificaciones: Notificacion[] }> {
    const datos = await peticion<RespuestaNovedades>('/novedades', { token })
    return {
      noLeidas: Number(datos.no_leidas) || 0,
      notificaciones: Array.isArray(datos.notificaciones) ? datos.notificaciones : [],
    }
  },

  marcarLeida(idNotificacion: number, token: string): Promise<unknown> {
    return peticion(`/novedades/${idNotificacion}/leida`, { token, metodo: 'POST' })
  },

  marcarTodasLeidas(token: string): Promise<unknown> {
    return peticion('/novedades/leer_todas', { token, metodo: 'POST' })
  },
}