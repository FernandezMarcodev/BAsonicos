import { peticion } from './http'
import type { Concierto, ListaConciertos } from '../tipos'

export const conciertoServicio = {
  async obtenerConciertos(): Promise<Concierto[]> {
    const datos = await peticion<ListaConciertos>('/conciertos')
    return Array.isArray(datos.conciertos) ? datos.conciertos : []
  },
}