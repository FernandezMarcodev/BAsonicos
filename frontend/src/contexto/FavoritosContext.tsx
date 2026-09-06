import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { favoritoServicio } from '../servicios/favoritoServicio'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import type { Concierto } from '../tipos'

interface FavoritosContextValue {
  cantidadFavoritos: number
  idsFavoritos: ReadonlySet<number>
  esFavorito: (id: number) => boolean
  alternarFavorito: (concierto: Concierto) => Promise<void>
}

const FavoritosContext = createContext<FavoritosContextValue | null>(null)

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const { token, usuario } = useAuth()
  const { mostrarToast } = useToast()
  const usuarioId = usuario?.id
  const [favoritos, setFavoritos] = useState<Concierto[]>([])

  useEffect(() => {
    if (!token || !usuarioId) {
      setFavoritos([])
      return
    }
    let activo = true
    favoritoServicio
      .obtenerFavoritos(token)
      .then((lista) => {
        if (activo) setFavoritos(lista)
      })
      .catch((err) => console.error('No se pudieron cargar los favoritos', err))
    return () => {
      activo = false
    }
  }, [token, usuarioId])

  const idsFavoritos = useMemo(() => new Set(favoritos.map((favorito) => favorito.id)), [favoritos])

  const esFavorito = useCallback((id: number) => idsFavoritos.has(id), [idsFavoritos])

  const alternarFavorito = useCallback(
    async (concierto: Concierto) => {
      if (!token) return
      const yaEsFavorito = idsFavoritos.has(concierto.id)

      setFavoritos((prev) =>
        yaEsFavorito
          ? prev.filter((favorito) => favorito.id !== concierto.id)
          : [concierto, ...prev],
      )

      try {
        if (yaEsFavorito) {
          await favoritoServicio.quitarFavorito(concierto.id, token)
          mostrarToast('Se quitó de tus favoritos', 'info')
        } else {
          await favoritoServicio.agregarFavorito(concierto.id, token)
          mostrarToast('Guardado en tus favoritos', 'exito')
        }
      } catch (err) {
        console.error(err)
        setFavoritos((prev) =>
          yaEsFavorito
            ? [concierto, ...prev]
            : prev.filter((favorito) => favorito.id !== concierto.id),
        )
        mostrarToast('No se pudo actualizar el favorito', 'error')
      }
    },
    [token, idsFavoritos, mostrarToast],
  )

  const valor = useMemo(
    () => ({
      cantidadFavoritos: favoritos.length,
      idsFavoritos,
      esFavorito,
      alternarFavorito,
    }),
    [favoritos.length, idsFavoritos, esFavorito, alternarFavorito],
  )

  return <FavoritosContext.Provider value={valor}>{children}</FavoritosContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavoritos(): FavoritosContextValue {
  const contexto = useContext(FavoritosContext)
  if (!contexto) {
    throw new Error('useFavoritos debe usarse dentro de <FavoritosProvider>')
  }
  return contexto
}