import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

// CLAVE_TEMA coincide con la clave que ya usaba Encabezado (localStorage "tema"):
// "oscuro" / "claro". Se mantiene por compatibilidad con la preferencia guardada.
const CLAVE_TEMA = 'tema'

interface TemaContextValue {
  modoOscuro: boolean
  cambiarTema: () => void
}

const TemaContext = createContext<TemaContextValue | null>(null)

function leerPreferencia(): boolean {
  try {
    return localStorage.getItem(CLAVE_TEMA) === 'oscuro'
  } catch {
    return false
  }
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [modoOscuro, setModoOscuro] = useState<boolean>(leerPreferencia)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', modoOscuro)
    try {
      localStorage.setItem(CLAVE_TEMA, modoOscuro ? 'oscuro' : 'claro')
    } catch {
      /* sin almacenamiento */
    }
  }, [modoOscuro])

  const cambiarTema = useCallback(() => {
    const aplicar = () => {
      setModoOscuro((prev) => !prev)
    }
    // View Transition API: la página entera hace un crossfade único (todo
    // junto), evitando que cada elemento se repinte por separado. Sin soporte
    // del navegador se cambia al instante.
    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(aplicar)
    } else {
      aplicar()
    }
  }, [])

  const valor = useMemo(() => ({ modoOscuro, cambiarTema }), [modoOscuro, cambiarTema])

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTema(): TemaContextValue {
  const contexto = useContext(TemaContext)
  if (!contexto) {
    throw new Error('useTema debe usarse dentro de <TemaProvider>')
  }
  return contexto
}