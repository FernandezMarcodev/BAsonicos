export type Coordenadas = [number, number]

export interface UbicacionDetalle {
  id: number
  nombre: string
  capacidad_total: number
  coordenadas: Coordenadas | null
  url_maps: string | null
}

export interface Concierto {
  id: number
  nombre: string
  artista: string
  url_evento: string | null
  ubicacion: number | null
  isAgotado: boolean
  isAptoMenores: boolean
  fecha: string | null
  hora: string | null
  ubicacion_detalle: UbicacionDetalle | null
}

export interface Usuario {
  id: number
  email: string
  nombre: string
  creado_en: string
}

export interface RespuestaAuth {
  token: string
  usuario: Usuario
}

export interface ListaConciertos {
  conciertos: Concierto[]
}

export interface RespuestaFavoritos {
  favoritos: Concierto[]
}

export interface PuntoUsuario {
  lat: number
  lng: number
  accuracy?: number
}

export interface FiltrosConcierto {
  artista: string
  radio: number
  ubicacionActual: PuntoUsuario | null
}

export interface CentroMapa {
  lat: number
  lng: number
  zoom?: number
}

export interface Notificacion {
  id: number
  leida: boolean
  creado_en: string
  concierto: Concierto
}

export interface RespuestaSeguidos {
  seguidos: string[]
}

export interface RespuestaNovedades {
  no_leidas: number
  notificaciones: Notificacion[]
}

export type VistaConciertos = 'todos' | 'favoritos' | 'siguiendo'