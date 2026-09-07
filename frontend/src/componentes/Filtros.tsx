import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type Dispatch, type SetStateAction } from 'react'
import { FiChevronDown, FiSearch } from 'react-icons/fi'
import type { FiltrosConcierto } from '../tipos'

interface Props {
  filtros: FiltrosConcierto
  setFiltros: Dispatch<SetStateAction<FiltrosConcierto>>
  artistas: string[]
}

const estilosControl =
  'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-[#36393f] dark:text-[#e3e2e9]'

const CLAVE_COLAPSADO = 'filtrosColapsados'

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function SelectorArtista({
  artistas,
  valor,
  alCambiar,
}: {
  artistas: string[]
  valor: string
  alCambiar: (artista: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  const [abierto, setAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(-1)
  const refContenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTexto(valor)
  }, [valor])

  useEffect(() => {
    if (!abierto) return
    function alClicAfuera(evento: MouseEvent) {
      if (!refContenedor.current?.contains(evento.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', alClicAfuera)
    return () => document.removeEventListener('mousedown', alClicAfuera)
  }, [abierto])

  const sugerencias = useMemo(() => {
    const termino = normalizar(texto.trim())
    if (!termino) return artistas.slice(0, 8)
    return artistas.filter((artista) => normalizar(artista).includes(termino)).slice(0, 8)
  }, [artistas, texto])

  function seleccionar(artista: string) {
    alCambiar(artista)
    setTexto(artista)
    setAbierto(false)
    setIndiceActivo(-1)
  }

  function alTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      setAbierto(false)
      return
    }
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAbierto(true)
      setIndiceActivo((anterior) => (anterior + 1) % Math.max(sugerencias.length, 1))
      return
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceActivo((anterior) => (anterior <= 0 ? sugerencias.length - 1 : anterior - 1))
      return
    }
    if (evento.key === 'Enter') {
      evento.preventDefault()
      if (abierto && sugerencias[indiceActivo]) {
        seleccionar(sugerencias[indiceActivo])
      }
    }
  }

  return (
    <div ref={refContenedor} className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted dark:text-[#c6c5cf]">
        <FiSearch className="text-base" />
      </div>
      <input
        value={texto}
        onChange={(evento) => {
          const nuevo = evento.target.value
          setTexto(nuevo)
          alCambiar(nuevo)
          setAbierto(true)
          setIndiceActivo(-1)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTecla}
        placeholder="Buscá un artista…"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        aria-label="Buscar artista"
        className={`${estilosControl} pl-9`}
      />
      {abierto && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-elevation-3 dark:border-white/10 dark:bg-[#2b2e33]">
          {sugerencias.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted dark:text-[#c6c5cf]">Sin coincidencias</p>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
              {sugerencias.map((sugerencia, indice) => (
                <li key={sugerencia}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={indice === indiceActivo}
                    onMouseEnter={() => setIndiceActivo(indice)}
                    onClick={() => seleccionar(sugerencia)}
                    className={`flex w-full items-center px-4 py-2 text-left text-sm transition-colors ${
                      indice === indiceActivo
                        ? 'bg-primary-surface text-primary dark:bg-primary/15'
                        : 'text-ink hover:bg-black/5 dark:text-[#e3e2e9] dark:hover:bg-white/5'
                    }`}
                  >
                    {sugerencia}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function leerColapsado(): boolean {
  try {
    const guardado = localStorage.getItem(CLAVE_COLAPSADO)
    if (guardado !== null) return guardado === '1'
  } catch {
    /* sin almacenamiento */
  }
  return typeof window !== 'undefined' && window.innerWidth < 1024
}

export default function Filtros({ filtros, setFiltros, artistas }: Props) {
  const [colapsado, setColapsado] = useState(leerColapsado)
  const ubicacionActiva = filtros.ubicacionActual !== null

  function alternarColapsado() {
    setColapsado((prev) => {
      const nuevo = !prev
      try {
        localStorage.setItem(CLAVE_COLAPSADO, nuevo ? '1' : '0')
      } catch {
        /* sin almacenamiento */
      }
      return nuevo
    })
  }

  function activarUbicacion() {
    if (!navigator.geolocation) {
      window.alert('Tu navegador no soporta geolocalización.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setFiltros({
          ...filtros,
          ubicacionActual: {
            lat: posicion.coords.latitude,
            lng: posicion.coords.longitude,
            accuracy: posicion.coords.accuracy,
          },
        })
      },
      (error) => {
        console.error('Error obteniendo ubicación', error)
        window.alert('No se pudo obtener tu ubicación. Revisá los permisos del navegador.')
      },
    )
  }

  function desactivarUbicacion() {
    setFiltros({ ...filtros, ubicacionActual: null })
  }

  const resumen = [
    filtros.artista ? `Artista: ${filtros.artista}` : 'Todos los artistas',
    filtros.ubicacionActual ? `cerca de tu ubicación · ${filtros.radio} km` : '',
  ]
    .filter(Boolean)
    .join(' – ')

  return (
    <section className="rounded-3xl border border-primary/15 bg-[#eef2fb] p-5 shadow-elevation-2 dark:border-white/10 dark:bg-[#2b2e33]">
      <button
        type="button"
        onClick={alternarColapsado}
        aria-expanded={!colapsado}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-ink dark:text-[#e3e2e9]">
            Filtrar conciertos
          </span>
          {colapsado && (
            <span className="truncate text-xs text-ink-muted dark:text-[#c6c5cf]">{resumen}</span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform dark:bg-[#36393f] dark:text-[#e3e2e9] ${
            colapsado ? '' : 'rotate-180'
          }`}
        >
          <FiChevronDown />
        </span>
      </button>

      {!colapsado && (
        <div className="grid gap-5 border-t border-primary/10 pt-4 sm:grid-cols-2 dark:border-white/10">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-muted dark:text-[#c6c5cf]">
                Cerca de tu ubicación
              </span>
              <button
                onClick={ubicacionActiva ? desactivarUbicacion : activarUbicacion}
                role="switch"
                aria-checked={ubicacionActiva}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  ubicacionActiva ? 'bg-primary' : 'bg-black/15 dark:bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-elevation-1 transition-all ${
                    ubicacionActiva ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {ubicacionActiva && (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-sm text-ink-muted dark:text-[#c6c5cf]">
                    <span>Radio de búsqueda</span>
                    <span className="font-semibold text-primary">{filtros.radio} km</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={filtros.radio}
                    onChange={(e) =>
                      setFiltros({ ...filtros, radio: Number(e.target.value) })
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-full"
                    style={{
                      background: `linear-gradient(to right, var(--color-primary) ${((filtros.radio - 1) / 49) * 100}%, rgba(0,0,0,0.10) ${((filtros.radio - 1) / 49) * 100}%)`,
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm text-ink-muted dark:text-[#c6c5cf]">
                    Radio en kilómetros
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={filtros.radio}
                    onChange={(e) =>
                      setFiltros({
                        ...filtros,
                        radio: Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                    className={`${estilosControl} appearance-none`}
                  />
                </label>
              </div>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-muted dark:text-[#c6c5cf]">
              Artista
            </span>
            <SelectorArtista
              artistas={artistas}
              valor={filtros.artista}
              alCambiar={(artista) => setFiltros({ ...filtros, artista })}
            />
            {artistas.length > 0 && (
              <p className="mt-2 text-xs text-ink-muted dark:text-[#c6c5cf]">
                {artistas.length} artistas disponibles
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}