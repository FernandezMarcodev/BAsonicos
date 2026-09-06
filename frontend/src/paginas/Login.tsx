import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Encabezado from '../componentes/Encabezado'
import CampoTexto from '../componentes/CampoTexto'
import Boton from '../componentes/Boton'
import EnlaceBoton from '../componentes/EnlaceBoton'
import { useAuth } from '../contexto/AuthContext'
import { useToast } from '../contexto/ToastContext'
import { ErrorApi } from '../servicios/http'

const EMAIL_REGEX = /^\S+@\S+\.\S+$/

interface Errores {
  email?: string
  password?: string
}

export default function Login() {
  const { usuario, iniciarSesion } = useAuth()
  const { mostrarToast } = useToast()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) {
    return <Navigate to="/" replace />
  }

  function validar(): boolean {
    const nuevos: Errores = {}
    if (!EMAIL_REGEX.test(email.trim())) {
      nuevos.email = 'Ingresá un correo electrónico válido.'
    }
    if (!password) {
      nuevos.password = 'Ingresá tu contraseña.'
    }
    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault()
    if (!validar()) return
    setEnviando(true)
    setErrorGeneral(null)
    try {
      await iniciarSesion({ email: email.trim(), password })
      mostrarToast('Sesión iniciada. ¡Bienvenido de nuevo!', 'exito')
      navegar('/')
    } catch (error) {
      console.error(error)
      if (error instanceof ErrorApi) {
        setErrorGeneral(error.status === 401 ? 'Credenciales incorrectas.' : error.message)
      } else {
        setErrorGeneral('No se pudo conectar con el servidor. Intentá nuevamente.')
      }
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Encabezado />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-subir rounded-3xl border border-black/5 bg-surface p-8 shadow-elevation-2 dark:bg-[#2b2e33]">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink dark:text-[#e3e2e9]">
            Ingresar
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted dark:text-[#c6c5cf]">
            Iniciá sesión para guardar tus favoritos.
          </p>

          <form onSubmit={manejarEnvio} noValidate className="mt-6 space-y-4">
            <CampoTexto
              etiqueta="Correo electrónico"
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              error={errores.email}
            />
            <CampoTexto
              etiqueta="Contraseña"
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              conOjo
              error={errores.password}
            />

            {errorGeneral && (
              <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">
                {errorGeneral}
              </p>
            )}

            <Boton type="submit" carga={enviando} disabled={enviando} className="w-full">
              Iniciar sesión
            </Boton>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted dark:text-[#c6c5cf]">
            ¿No tenés cuenta?{' '}
            <EnlaceBoton variante="texto" to="/registro" className="px-1 py-0 text-sm font-semibold">
              Crear cuenta
            </EnlaceBoton>
          </p>
        </div>
      </main>
    </div>
  )
}