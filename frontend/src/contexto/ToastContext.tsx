import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi'

type TipoToast = 'exito' | 'error' | 'info'

interface Toast {
  id: number
  tipo: TipoToast
  mensaje: string
}

interface ToastContextValue {
  mostrarToast: (mensaje: string, tipo?: TipoToast) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const iconos: Record<TipoToast, ReactNode> = {
  exito: <FiCheckCircle />,
  error: <FiAlertCircle />,
  info: <FiInfo />,
}

const coloresIcono: Record<TipoToast, string> = {
  exito: 'text-success',
  error: 'text-[#ff8a80]',
  info: 'text-primary',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const contador = useRef(0)

  const mostrarToast = useCallback((mensaje: string, tipo: TipoToast = 'info') => {
    const id = ++contador.current
    setToasts((prev) => [...prev, { id, tipo, mensaje }].slice(-4))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[9999] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="animate-subir pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-[#2b2e33]/95 px-4 py-3 text-sm font-medium text-white shadow-elevation-3 backdrop-blur dark:border-black/10"
          >
            <span className={`text-lg ${coloresIcono[toast.tipo]}`}>{iconos[toast.tipo]}</span>
            <span>{toast.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const contexto = useContext(ToastContext)
  if (!contexto) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>')
  }
  return contexto
}