import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { seguidoServicio } from '../servicios/seguidoServicio'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import type { Notificacion } from '../tipos'

function normalizar(artista: string): string {
  return artista.trim().toLowerCase()
}

interface SeguidosContextValue {
  seguidos: string[]
  esSeguido: (artista: string) => boolean
  seguir: (artista: string) => Promise<void>
  dejarDeSeguir: (artista: string) => Promise<void>
  noLeidas: number
  notificaciones: Notificacion[]
  cargandoNovedades: boolean
  marcarLeida: (id: number) => Promise<void>
  marcarTodasLeidas: () => Promise<void>
}

const SeguidosContext = createContext<SeguidosContextValue | null>(null)

export function SeguidosProvider({ children }: { children: ReactNode }) {
  const { token, usuario } = useAuth()
  const { mostrarToast } = useToast()
  const usuarioId = usuario?.id
  const [seguidos, setSeguidos] = useState<string[]>([])
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [cargandoNovedades, setCargandoNovedades] = useState(false)

  useEffect(() => {
    if (!token || !usuarioId) {
      setSeguidos([])
      setNotificaciones([])
      return
    }
    let activo = true
    setCargandoNovedades(true)

    Promise.all([seguidoServicio.obtenerSeguidos(token), seguidoServicio.obtenerNovedades(token)])
      .then(([lista, novedades]) => {
        if (!activo) return
        setSeguidos(lista)
        setNotificaciones(novedades.notificaciones)
      })
      .catch((err) => console.error('No se pudieron cargar seguidos/novedades', err))
      .finally(() => {
        if (activo) setCargandoNovedades(false)
      })

    return () => {
      activo = false
    }
  }, [token, usuarioId])

  const setSeguidosNormalizado = useMemo(() => new Set(seguidos.map(normalizar)), [seguidos])

  const esSeguido = useCallback(
    (artista: string) => (artista.trim() ? setSeguidosNormalizado.has(normalizar(artista)) : false),
    [setSeguidosNormalizado],
  )

  const seguir = useCallback(
    async (artista: string) => {
      if (!token || !artista.trim() || esSeguido(artista)) return
      const nombre = normalizar(artista)

      setSeguidos((prev) => (prev.includes(nombre) ? prev : [...prev, nombre]))

      try {
        await seguidoServicio.seguirArtista(artista, token)
        mostrarToast(`Ahora seguís a ${artista.trim()}`, 'exito')
      } catch (err) {
        console.error(err)
        setSeguidos((prev) => prev.filter((a) => a !== nombre))
        mostrarToast('No se pudo seguir al artista', 'error')
      }
    },
    [token, esSeguido, mostrarToast],
  )

  const dejarDeSeguir = useCallback(
    async (artista: string) => {
      if (!token || !artista.trim() || !esSeguido(artista)) return
      const nombre = normalizar(artista)

      setSeguidos((prev) => prev.filter((a) => a !== nombre))

      try {
        await seguidoServicio.dejarDeSeguir(artista, token)
        mostrarToast(`Dejaste de seguir a ${artista.trim()}`, 'info')
      } catch (err) {
        console.error(err)
        setSeguidos((prev) => (prev.includes(nombre) ? prev : [...prev, nombre].sort()))
        mostrarToast('No se pudo dejar de seguir al artista', 'error')
      }
    },
    [token, esSeguido, mostrarToast],
  )

  const noLeidas = useMemo(() => notificaciones.filter((nota) => !nota.leida).length, [notificaciones])

  const marcarLeida = useCallback(
    async (id: number) => {
      if (!token) return
      const nota = notificaciones.find((n) => n.id === id)
      if (!nota || nota.leida) return

      setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))

      try {
        await seguidoServicio.marcarLeida(id, token)
      } catch (err) {
        console.error(err)
        setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: false } : n)))
      }
    },
    [token, notificaciones],
  )

  const marcarTodasLeidas = useCallback(async () => {
    if (!token) return
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))

    try {
      await seguidoServicio.marcarTodasLeidas(token)
    } catch (err) {
      console.error(err)
      setNotificaciones((prev) => prev.map((n) => (n.leida ? { ...n, leida: false } : n)))
    }
  }, [token])

  const valor = useMemo(
    () => ({
      seguidos,
      esSeguido,
      seguir,
      dejarDeSeguir,
      noLeidas,
      notificaciones,
      cargandoNovedades,
      marcarLeida,
      marcarTodasLeidas,
    }),
    [
      seguidos,
      esSeguido,
      seguir,
      dejarDeSeguir,
      noLeidas,
      notificaciones,
      cargandoNovedades,
      marcarLeida,
      marcarTodasLeidas,
    ],
  )

  return <SeguidosContext.Provider value={valor}>{children}</SeguidosContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSeguidos(): SeguidosContextValue {
  const contexto = useContext(SeguidosContext)
  if (!contexto) {
    throw new Error('useSeguidos debe usarse dentro de <SeguidosProvider>')
  }
  return contexto
}