import { peticion } from './http'
import type { Concierto, RespuestaFavoritos } from '../tipos'

export const favoritoServicio = {
  async obtenerFavoritos(token: string): Promise<Concierto[]> {
    const datos = await peticion<RespuestaFavoritos>('/favoritos', { token })
    return Array.isArray(datos.favoritos) ? datos.favoritos : []
  },

  agregarFavorito(conciertoId: number, token: string): Promise<unknown> {
    return peticion(`/favoritos/${conciertoId}`, { token, metodo: 'POST' })
  },

  quitarFavorito(conciertoId: number, token: string): Promise<unknown> {
    return peticion(`/favoritos/${conciertoId}`, { token, metodo: 'DELETE' })
  },
}