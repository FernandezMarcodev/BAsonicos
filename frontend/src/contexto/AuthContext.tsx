import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { authServicio, type Credenciales, type RegistroDatos } from '../servicios/authServicio'
import { ErrorApi } from '../servicios/http'
import type { Usuario } from '../tipos'

const CLAVE_TOKEN = 'concierto_finder_token'

interface AuthContextValue {
  usuario: Usuario | null
  token: string | null
  /* cargando = true mientras se verifica la sesión guardada al arrancar. */
  cargando: boolean
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
  const [cargando, setCargando] = useState(() => Boolean(leerToken()))

  useEffect(() => {
    if (!token) {
      setCargando(false)
      return
    }
    let activo = true

    authServicio
      .obtenerPerfil(token)
      .then((perfil) => {
        if (activo) {
          setUsuario(perfil)
          setCargando(false)
        }
      })
      .catch((err) => {
        if (!activo) return
        // Solo un 401/403 indica token inválido o expirado -> sesión cerrada.
        // Un error de red o 5xx NO debe desloguear al usuario.
        const esNoAutorizado = err instanceof ErrorApi && (err.status === 401 || err.status === 403)
        if (esNoAutorizado) {
          guardarToken(null)
          setToken(null)
          setUsuario(null)
        }
        setCargando(false)
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
      value={{ usuario, token, cargando, registrar, iniciarSesion, cerrarSesion }}
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