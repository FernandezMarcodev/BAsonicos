import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell, FiBellOff, FiCheck, FiHeart, FiMoon, FiSun } from 'react-icons/fi'
import { useAuth } from '../contexto/AuthContext'
import { useFavoritos } from '../contexto/FavoritosContext'
import { useSeguidos } from '../contexto/SeguidosContext'
import { useTema } from '../contexto/TemaContext'
import { useToast } from '../contexto/ToastContext'
import * as pushServicio from '../servicios/pushServicio'
import { artistaDuplicadoEnTitulo } from '../utilidades/texto'
import Boton from './Boton'
import EnlaceBoton from './EnlaceBoton'
import type { Notificacion } from '../tipos'

function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const partes = fecha.split('-')
  if (partes.length !== 3) return fecha
  return `${Number(partes[2])}/${partes[1]}`
}

function ActivadorPush() {
  const { token } = useAuth()
  const { mostrarToast } = useToast()
  const [disponible, setDisponible] = useState<'cargando' | 'no' | 'si'>('cargando')
  const [claveVapid, setClaveVapid] = useState('')
  const [activa, setActiva] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    let vivo = true

    async function inicializar() {
      if (!pushServicio.pushSoportado()) {
        if (vivo) setDisponible('no')
        return
      }
      const info = await pushServicio.obtenerInfoVapid()
      if (!info.activo || !info.clave_publica) {
        if (vivo) setDisponible('no')
        return
      }
      const suscripcion = await pushServicio.obtenerSuscripcionActiva()
      if (!vivo) return
      setClaveVapid(info.clave_publica)
      setActiva(Boolean(suscripcion))
      setDisponible('si')
    }

    void inicializar().catch(() => {
      if (vivo) setDisponible('no')
    })
    return () => {
      vivo = false
    }
  }, [])

  async function activar() {
    if (!token) return
    setTrabajando(true)
    try {
      const suscripcion = await pushServicio.suscribirPush(claveVapid)
      if (!suscripcion) {
        mostrarToast('Permiso de notificaciones denegado', 'error')
        return
      }
      await pushServicio.guardarSuscripcion(token, suscripcion)
      setActiva(true)
      mostrarToast('Notificaciones activadas', 'exito')
    } catch {
      mostrarToast('No se pudieron activar las notificaciones', 'error')
    } finally {
      setTrabajando(false)
    }
  }

  async function desactivar() {
    if (!token) return
    setTrabajando(true)
    try {
      await pushServicio.desuscribir(token)
      setActiva(false)
      mostrarToast('Notificaciones desactivadas', 'info')
    } catch {
      mostrarToast('No se pudieron desactivar las notificaciones', 'error')
    } finally {
      setTrabajando(false)
    }
  }

  if (disponible === 'cargando') {
    return (
      <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
        <p className="text-xs text-ink-muted dark:text-[#c6c5cf]">Revisando notificaciones…</p>
      </div>
    )
  }

  if (disponible === 'no') {
    return (
      <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
        <p className="flex items-center gap-2 text-xs text-ink-muted dark:text-[#c6c5cf]">
          <FiBellOff className="shrink-0" />
          Notificaciones no disponibles en este navegador
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-ink dark:text-[#e3e2e9]">
          <FiBell className={`shrink-0 text-base ${activa ? 'text-accent' : ''}`} />
          {activa ? 'Notificaciones activadas' : '¿Te avisamos por push?'}
        </p>
        <button
          onClick={() => void (activa ? desactivar() : activar())}
          disabled={trabajando}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            activa
              ? 'bg-black/5 text-ink hover:bg-black/10 dark:bg-white/10 dark:text-[#e3e2e9] dark:hover:bg-white/15'
              : 'bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {activa ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  )
}

function CampanaNovedades() {
  const { noLeidas, notificaciones, cargandoNovedades, marcarLeida, marcarTodasLeidas } = useSeguidos()
  const [abierta, setAbierta] = useState(false)
  const navegar = useNavigate()

  function abrirNotificacion(notificacion: Notificacion) {
    void marcarLeida(notificacion.id)
    setAbierta(false)
    // El concierto viaja por route state: Inicio lo lee al montar, evitando que
    // se pierda si esta página todavía no estaba montada.
    navegar('/', { state: { conciertoEnfocar: notificacion.concierto } })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierta((prev) => !prev)}
        aria-label={`Novedades${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ''}`}
        aria-expanded={abierta}
        title={noLeidas > 0 ? `${noLeidas} novedad sin leer` : 'Novedades'}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-[#e3e2e9] transition-colors hover:bg-white/15"
      >
        <FiBell />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierta(false)} aria-hidden="true" />
          <div className="fixed inset-x-4 top-[4.5rem] z-50 mx-auto flex max-h-[calc(100dvh-6rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-black/5 bg-white/95 shadow-elevation-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#2b2e33]/95 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-2 sm:max-h-96 sm:w-80">
            <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
              <p className="font-display text-sm font-semibold text-ink dark:text-[#e3e2e9]">
                Novedades
                {noLeidas > 0 && <span className="ml-1.5 text-accent">· {noLeidas} sin leer</span>}
              </p>
              <button
                onClick={() => void marcarTodasLeidas()}
                disabled={noLeidas === 0}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition-colors hover:text-accent-hover disabled:cursor-default disabled:opacity-40"
              >
                <FiCheck className="text-sm" />
                Marcar todas
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cargandoNovedades ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted dark:text-[#c6c5cf]">
                  Cargando novedades…
                </p>
              ) : notificaciones.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted dark:text-[#c6c5cf]">
                  Sin novedades todavía. Seguí artistas para enterarte de sus nuevos conciertos.
                </p>
              ) : (
                <ul className="py-1">
                  {notificaciones.slice(0, 8).map((notificacion) => (
                    <li key={notificacion.id}>
                      <button
                        onClick={() => abrirNotificacion(notificacion)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notificacion.leida ? 'bg-transparent' : 'bg-accent'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          {!artistaDuplicadoEnTitulo(
                            notificacion.concierto.nombre,
                            notificacion.concierto.artista,
                          ) && (
                            <span className="block truncate text-sm font-semibold text-ink dark:text-[#e3e2e9]">
                              {notificacion.concierto.artista}
                            </span>
                          )}
                          {artistaDuplicadoEnTitulo(
                            notificacion.concierto.nombre,
                            notificacion.concierto.artista,
                          ) ? (
                            <span className="block truncate text-sm font-semibold text-ink dark:text-[#e3e2e9]">
                              {notificacion.concierto.artista}
                            </span>
                          ) : (
                            <span className="block truncate text-xs text-ink-muted dark:text-[#c6c5cf]">
                              {notificacion.concierto.nombre}
                            </span>
                          )}
                          <span className="mt-0.5 block truncate text-xs text-ink-muted/80 dark:text-[#c6c5cf]">
                            {fechaCorta(notificacion.concierto.fecha)}
                            {notificacion.concierto.hora ? ` · ${notificacion.concierto.hora.slice(0, 5)} hs` : ''}
                            {notificacion.concierto.ubicacion_detalle?.nombre
                              ? ` · ${notificacion.concierto.ubicacion_detalle.nombre}`
                              : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {notificaciones.length > 8 && (
                    <li className="px-4 py-2 text-center text-xs text-ink-muted dark:text-[#c6c5cf]">
                      Mostrando las 8 más recientes
                    </li>
                  )}
                </ul>
              )}
            </div>

            <ActivadorPush />
          </div>
        </>
      )}
    </div>
  )
}

export default function Encabezado() {
  const { usuario, cargando, cerrarSesion } = useAuth()
  const { cantidadFavoritos } = useFavoritos()
  const { modoOscuro, cambiarTema } = useTema()
  const { mostrarToast } = useToast()
  const navegar = useNavigate()

  function cerrar() {
    cerrarSesion()
    navegar('/')
    mostrarToast('Sesión cerrada', 'info')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f1115]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <nav aria-label="Principal" className="flex items-center gap-2.5">
          <a href="#/" className="flex items-center gap-2.5" aria-label="Ir al inicio">
            <img
              src="/logo.svg"
              alt="BAsónicos"
              className="h-9 w-9 rounded-xl shadow-elevation-1"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              BAsónicos
            </span>
          </a>
        </nav>

        <div className="flex items-center gap-1.5">
          {usuario && (
            <>
              {cantidadFavoritos > 0 && (
                <button
                  onClick={() => navegar('/', { state: { vistaConciertos: 'favoritos' } })}
                  title="Mis favoritos"
                  aria-label={`Mis favoritos (${cantidadFavoritos})`}
                  className="relative inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-medium text-[#e3e2e9] transition-colors hover:bg-white/15"
                >
                  <FiHeart className="fill-danger text-danger" />
                  <span className="tabular-nums">{cantidadFavoritos}</span>
                </button>
              )}
              <CampanaNovedades />
            </>
          )}

          {usuario ? (
            <>
              <span className="hidden items-center gap-2 text-sm text-[#c6c5cf] md:flex">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white"
                  aria-hidden="true"
                >
                  {usuario.nombre.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <span className="max-w-40 truncate">
                  Hola, <span className="font-medium text-white">{usuario.nombre}</span>
                </span>
              </span>
              <Boton variante="texto" onClick={cerrar} className="px-3.5 py-2">
                Cerrar sesión
              </Boton>
            </>
          ) : cargando ? (
            /* Mientras se verifica la sesión guardada no mostramos botones de login */
            <span
              className="h-10 w-24 animate-pulse rounded-full bg-white/10"
              aria-label="Comprobando sesión"
            />
          ) : (
            <>
              <EnlaceBoton variante="texto" to="/login" className="px-3.5 py-2">
                Ingresar
              </EnlaceBoton>
              <EnlaceBoton to="/registro" className="px-4 py-2">
                Registrarse
              </EnlaceBoton>
            </>
          )}

          <button
            onClick={cambiarTema}
            aria-label={modoOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={modoOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-[#e3e2e9] transition-colors hover:bg-white/15"
          >
            {modoOscuro ? <FiSun /> : <FiMoon />}
          </button>
        </div>
      </div>
    </header>
  )
}