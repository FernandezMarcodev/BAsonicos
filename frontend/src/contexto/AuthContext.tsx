import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { authServicio, type Credenciales, type RegistroDatos } from '../servicios/authServicio'
import type { Usuario } from '../tipos'

const CLAVE_TOKEN = 'concierto_finder_token'

interface AuthContextValue {
  usuario: Usuario | null
  token: string | null
  registrar: (datos: RegistroDatos) => Promise<void>
  iniciarSesion: (credenciales: Credenciales) => Promise<void>
  cerrarSesion: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

function guardarToken(token: string | null) {
  if (token) {
    localStorage.setItem(CLAVE_TOKEN, token)
  } else {
    localStorage.removeItem(CLAVE_TOKEN)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [token, setToken] = useState<string | null>(leerToken)

  useEffect(() => {
    if (!token) return
    let activo = true

    authServicio
      .obtenerPerfil(token)
      .then((perfil) => {
        if (activo) setUsuario(perfil)
      })
      .catch(() => {
        guardarToken(null)
        if (activo) {
          setToken(null)
          setUsuario(null)
        }
      })

    return () => {
      activo = false
    }
  }, [token])

  const registrar = async (datos: RegistroDatos) => {
    const respuesta = await authServicio.registrar(datos)
    guardarToken(respuesta.token)
    setToken(respuesta.token)
    setUsuario(respuesta.usuario)
  }

  const iniciarSesion = async (credenciales: Credenciales) => {
    const respuesta = await authServicio.iniciarSesion(credenciales)
    guardarToken(respuesta.token)
    setToken(respuesta.token)
    setUsuario(respuesta.usuario)
  }

  const cerrarSesion = () => {
    guardarToken(null)
    setToken(null)
    setUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{ usuario, token, registrar, iniciarSesion, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext)
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return contexto
}