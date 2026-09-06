import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { FiLoader } from 'react-icons/fi'
import { useRipple } from './ripple'
import { estilosVariantes, type Variante } from './estilosBoton'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  carga?: boolean
  children: ReactNode
}

export default function Boton({
  variante = 'primario',
  carga = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  const usoRipple = useRipple<HTMLButtonElement>()
  const tipo = rest.type ?? 'button'

  return (
    <button
      {...rest}
      type={tipo}
      onPointerDown={usoRipple}
      disabled={disabled || carga}
      className={`ripple-superficie inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-60 ${estilosVariantes[variante]} ${className}`}
    >
      {carga && <FiLoader className="animate-spin" />}
      {children}
    </button>
  )
}