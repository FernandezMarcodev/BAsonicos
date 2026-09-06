import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useRipple } from './ripple'
import { estilosVariantes, type Variante } from './estilosBoton'

interface Props {
  to?: string
  href?: string
  variante?: Variante
  className?: string
  children: ReactNode
}

export default function EnlaceBoton({
  to,
  href,
  variante = 'primario',
  className = '',
  children,
}: Props) {
  const usoRipple = useRipple<HTMLAnchorElement>()
  const clases = `ripple-superficie inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${estilosVariantes[variante]} ${className}`

  if (to) {
    return (
      <Link to={to} onPointerDown={usoRipple} className={clases}>
        {children}
      </Link>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clases}
      onPointerDown={usoRipple}
    >
      {children}
    </a>
  )
}