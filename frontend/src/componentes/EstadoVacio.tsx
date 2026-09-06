import { FiAlertCircle, FiInbox } from 'react-icons/fi'
import Boton from './Boton'

interface Props {
  tipo: 'error' | 'sin-resultados'
  titulo?: string
  subtitulo?: string
  onReiniciar?: () => void
}

export default function EstadoVacio({ tipo, titulo, subtitulo, onReiniciar }: Props) {
  const esError = tipo === 'error'
  const tituloMostrado = esError
    ? 'No se pudieron cargar los conciertos'
    : (titulo ?? 'No hay conciertos que coincidan')
  const subtituloMostrado = esError
    ? 'Revisá que la API esté disponible e intentá nuevamente.'
    : (subtitulo ?? 'Probá cambiar los filtros de artista o de ubicación.')

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-black/10 bg-white/60 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/5 text-2xl text-ink-muted dark:bg-white/10 dark:text-[#c6c5cf]">
        {esError ? <FiAlertCircle /> : <FiInbox />}
      </div>
      <p className="font-display text-lg font-semibold text-ink dark:text-[#e3e2e9]">
        {tituloMostrado}
      </p>
      <p className="max-w-sm text-sm text-ink-muted dark:text-[#c6c5cf]">{subtituloMostrado}</p>
      {onReiniciar && !esError && (
        <Boton variante="tonal" onClick={onReiniciar} className="mt-1">
          Restablecer filtros
        </Boton>
      )}
    </div>
  )
}