import { useState, type InputHTMLAttributes } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  error?: string
  ayuda?: string
  conOjo?: boolean
}

export default function CampoTexto({
  etiqueta,
  id,
  error,
  ayuda,
  conOjo = false,
  type = 'text',
  className = '',
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false)
  const esPassword = type === 'password'
  const tipoReal = esPassword && visible ? 'text' : type
  const conError = Boolean(error)

  return (
    <div className="w-full">
      <label htmlFor={id} className="block">
        <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink-muted dark:text-[#c6c5cf]">
          {etiqueta}
          {rest.required && (
            <span className="text-danger" title="Requerido">
              *
            </span>
          )}
        </span>
        <div className="relative">
          <input
            id={id}
            type={tipoReal}
            {...rest}
            className={`w-full rounded-xl border bg-white px-4 py-2.5 text-ink outline-none transition placeholder:text-ink-muted/60 dark:bg-[#36393f] dark:text-[#e3e2e9] ${
              esPassword && conOjo ? 'pr-11' : ''
            } ${
              conError
                ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/25'
                : 'border-black/10 focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/10'
            } ${className}`}
          />
          {esPassword && conOjo && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition-colors hover:text-ink dark:hover:text-[#e3e2e9]"
            >
              {visible ? <FiEyeOff /> : <FiEye />}
            </button>
          )}
        </div>
      </label>
      {conError ? (
        <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
      ) : ayuda ? (
        <p className="mt-1.5 text-xs text-ink-muted dark:text-[#c6c5cf]">{ayuda}</p>
      ) : null}
    </div>
  )
}