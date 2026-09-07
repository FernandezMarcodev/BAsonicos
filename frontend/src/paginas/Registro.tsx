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

const REQUERIMIENTOS_PASSWORD = [
  '8 caracteres',
  'una mayúscula',
  'una minúscula',
  'un número',
  'un carácter especial',
] as const

interface Errores {
  nombre?: string
  email?: string
  password?: string
  confirmacion?: string
}

export default function Registro() {
  const { usuario, registrar } = useAuth()
  const { mostrarToast } = useToast()
  const navegar = useNavigate()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) {
    return <Navigate to="/app" replace />
  }

  function passwordCumpleRequisitos(pw: string): boolean {
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /\d/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    )
  }

  function validar(): boolean {
    const nuevos: Errores = {}
    if (!nombre.trim()) {
      nuevos.nombre = 'Ingresá tu nombre.'
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      nuevos.email = 'Ingresá un correo electrónico válido.'
    }
    if (!passwordCumpleRequisitos(password)) {
      nuevos.password = `La contraseña debe tener ${REQUERIMIENTOS_PASSWORD.join(', ')}.`
    }
    if (confirmacion !== password) {
      nuevos.confirmacion = 'Las contraseñas no coinciden.'
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
      await registrar({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
      })
      mostrarToast('Cuenta creada. ¡Ya podés guardar favoritos!', 'exito')
      navegar('/app')
    } catch (error) {
      console.error(error)
      if (error instanceof ErrorApi && error.status === 409) {
        setErrorGeneral('Ya existe una cuenta con ese correo. Probá ingresar.')
      } else if (error instanceof ErrorApi) {
        setErrorGeneral(error.message)
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
            Crear cuenta
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted dark:text-[#c6c5cf]">
            Registrate para guardar conciertos y verlos después.
          </p>

          <form onSubmit={manejarEnvio} noValidate className="mt-6 space-y-4">
            <CampoTexto
              etiqueta="Nombre"
              id="nombre"
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              required
              error={errores.nombre}
            />
            <CampoTexto
              etiqueta="Correo electrónico"
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              required
              error={errores.email}
            />
            <CampoTexto
              etiqueta="Contraseña"
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              conOjo
              required
              ayuda={`Usá al menos ${REQUERIMIENTOS_PASSWORD.join(', ')}.`}
              error={errores.password}
            />
            <CampoTexto
              etiqueta="Repetir contraseña"
              id="confirmacion"
              type="password"
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder="Repetí tu contraseña"
              conOjo
              required
              error={errores.confirmacion}
            />

            {errorGeneral && (
              <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">
                {errorGeneral}
              </p>
            )}

            <Boton type="submit" carga={enviando} disabled={enviando} className="w-full">
              Crear cuenta
            </Boton>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted dark:text-[#c6c5cf]">
            ¿Ya tenés cuenta?{' '}
            <EnlaceBoton variante="texto" to="/login" className="px-1 py-0 text-sm font-semibold">
              Ingresar
            </EnlaceBoton>
          </p>
        </div>
      </main>
    </div>
  )
}