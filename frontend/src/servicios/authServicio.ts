import { peticion } from './http'
import type { RespuestaAuth, Usuario } from '../tipos'

export interface Credenciales {
  email: string
  password: string
}

export interface RegistroDatos extends Credenciales {
  nombre: string
}

export const authServicio = {
  async registrar(datos: RegistroDatos): Promise<RespuestaAuth> {
    return peticion<RespuestaAuth>('/registro', { metodo: 'POST', cuerpo: datos })
  },

  async iniciarSesion(credenciales: Credenciales): Promise<RespuestaAuth> {
    return peticion<RespuestaAuth>('/login', { metodo: 'POST', cuerpo: credenciales })
  },

  async obtenerPerfil(token: string): Promise<Usuario> {
    return peticion<Usuario>('/me', { token })
  },
}