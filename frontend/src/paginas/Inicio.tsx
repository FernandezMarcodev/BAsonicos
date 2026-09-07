import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FiList, FiMapPin } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import Encabezado from '../componentes/Encabezado'
import Filtros from '../componentes/Filtros'
import Mapa from '../componentes/Mapa'
import TarjetaConcierto from '../componentes/TarjetaConcierto'
import EstadoVacio from '../componentes/EstadoVacio'
import PieDePagina from '../componentes/PieDePagina'
import { conciertoServicio } from '../servicios/conciertoServicio'
import { useAuth } from '../contexto/AuthContext'
import { useFavoritos } from '../contexto/FavoritosContext'
import { useSeguidos } from '../contexto/SeguidosContext'
import { normalizarTexto } from '../utilidades/texto'
import type { CentroMapa, Concierto, FiltrosConcierto, VistaConciertos } from '../tipos'

type Vista = 'mapa' | 'lista'

function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radianes = (grados: number) => (grados * Math.PI) / 180
  const radioTierra = 6371
  const c = 2 * Math.asin(
    Math.sqrt(
      Math.sin((radianes(lat2) - radianes(lat1)) / 2) ** 2 +
        Math.cos(radianes(lat1)) *
          Math.cos(radianes(lat2)) *
          Math.sin((radianes(lon2) - radianes(lon1)) / 2) ** 2,
    ),
  )
  return radioTierra * c
}

export default function Inicio() {
  const { usuario } = useAuth()
  const { idsFavoritos, cantidadFavoritos } = useFavoritos()
  const { seguidos } = useSeguidos()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const stateNavegacion = useMemo(
    () => ubicacion.state as { conciertoEnfocar?: Concierto; vistaConciertos?: VistaConciertos } | null,
    [ubicacion.state],
  )
  const conciertoEnfocarInicial = stateNavegacion?.conciertoEnfocar ?? null
  const [conciertoSeleccionado, setConciertoSeleccionado] = useState<Concierto | null>(null)
  const [conciertosBase, setConciertosBase] = useState<Concierto[]>([])
  const [conciertos, setConciertos] = useState<Concierto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [centroMapa, setCentroMapa] = useState<CentroMapa | null>(null)
  const [vista, setVista] = useState<Vista>('mapa')
  const [vistaConciertos, setVistaConciertos] = useState<VistaConciertos>(
    stateNavegacion?.vistaConciertos ?? 'todos',
  )
  const [filtros, setFiltros] = useState<FiltrosConcierto>({
    artista: '',
    radio: 5,
    ubicacionActual: null,
  })
  const refColumnaMapa = useRef<HTMLDivElement>(null)
  const conciertoEnfocarRef = useRef(conciertoEnfocarInicial)

  const artistas = useMemo(
    () =>
      Array.from(
        new Set(
          conciertosBase
            .filter((concierto) => concierto.artista?.trim())
            .map((concierto) => concierto.artista),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [conciertosBase],
  )

  const setSeguidosNorm = useMemo(() => new Set(seguidos), [seguidos])

  function seleccionarConcierto(concierto: Concierto) {
    const coordenadas = concierto.ubicacion_detalle?.coordenadas
    if (!coordenadas || coordenadas.length !== 2) return
    setCentroMapa({ lat: coordenadas[1], lng: coordenadas[0], zoom: 15 })
    setConciertoSeleccionado(concierto)
    if (window.innerWidth < 1024) {
      setVista('mapa')
      window.setTimeout(() => refColumnaMapa.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
  }

  const seleccionarRef = useRef(seleccionarConcierto)
  seleccionarRef.current = seleccionarConcierto

  // Si llegamos desde una notificación (route state), enfocamos el concierto.
  // Se ejecuta una sola vez por montaje para evitar re-enfocar en cada navegación.
  useEffect(() => {
    const conciertoNavegar = conciertoEnfocarRef.current
    if (!conciertoNavegar) return
    conciertoEnfocarRef.current = null
    seleccionarRef.current(conciertoNavegar)
  }, [])

  function reiniciarFiltros() {
    setFiltros({ artista: '', radio: 5, ubicacionActual: null })
    setVistaConciertos('todos')
  }

  function seleccionarVista(nueva: VistaConciertos) {
    if (nueva === 'favoritos' && !usuario) {
      navegar('/login')
      return
    }
    setVistaConciertos(nueva)
  }

  useEffect(() => {
    let activo = true
    const cargarConciertos = async () => {
      try {
        setCargando(true)
        setError(null)
        const datos = await conciertoServicio.obtenerConciertos()
        if (activo) {
          setConciertosBase(datos)
          setConciertos(datos)
        }
      } catch (err) {
        console.error(err)
        if (activo) setError('No se pudieron cargar los conciertos')
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargarConciertos()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (conciertosBase.length === 0) return
    const timeout = window.setTimeout(() => {
      const nombreArtista = normalizarTexto(filtros.artista)
      const filtrados = conciertosBase.filter((concierto) => {
        if (vistaConciertos === 'favoritos' && !idsFavoritos.has(concierto.id)) {
          return false
        }
        if (vistaConciertos === 'siguiendo') {
          if (!concierto.artista?.trim() || !setSeguidosNorm.has(concierto.artista.trim().toLowerCase())) {
            return false
          }
        }
        if (nombreArtista && !normalizarTexto(concierto.artista).includes(nombreArtista)) {
          return false
        }
        const coordenadas = concierto.ubicacion_detalle?.coordenadas
        if (filtros.ubicacionActual && coordenadas && coordenadas.length === 2) {
          const distancia = distanciaKm(
            filtros.ubicacionActual.lat,
            filtros.ubicacionActual.lng,
            coordenadas[1],
            coordenadas[0],
          )
          return distancia <= filtros.radio
        }
        return true
      })
      setConciertos(filtrados)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [conciertosBase, filtros, vistaConciertos, idsFavoritos, setSeguidosNorm])

  const cantidadConciertos = conciertos.length

  const botonTab = (tab: Vista, icono: ReactNode, etiqueta: string) => (
    <button
      onClick={() => setVista(tab)}
      aria-pressed={vista === tab}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
        vista === tab
          ? 'bg-accent text-white shadow-elevation-1'
          : 'text-ink-muted hover:text-ink dark:text-[#c6c5cf] dark:hover:text-[#e3e2e9]'
      }`}
    >
      {icono}
      {etiqueta}
    </button>
  )

  const segmentos: { valor: VistaConciertos; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    {
      valor: 'favoritos',
      etiqueta: cantidadFavoritos > 0 ? `Mis favoritos (${cantidadFavoritos})` : 'Mis favoritos',
    },
    { valor: 'siguiendo', etiqueta: 'Siguiendo' },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      <Encabezado />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <section className="rounded-3xl border border-black/5 bg-surface p-6 shadow-elevation-1 sm:p-8 dark:border-white/10 dark:bg-[#2b2e33]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-surface px-3.5 py-1.5 text-xs font-semibold text-primary dark:bg-primary/15">
            Buenos Aires y alrededores
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-[#e3e2e9]">
            Encontrá tu próximo concierto
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-muted dark:text-[#c6c5cf]">
            Explorá los conciertos más destacados de la región en el mapa y filtrá por
            artista o por cercanía a tu ubicación actual.
          </p>
        </section>

        <div className="mb-4">
          <Filtros filtros={filtros} setFiltros={setFiltros} artistas={artistas} />
        </div>

        <div className="mb-4 flex gap-1 rounded-full bg-black/5 p-1 dark:bg-white/10">
          {segmentos.map((segmento) => (
            <button
              key={segmento.valor}
              onClick={() => seleccionarVista(segmento.valor)}
              aria-pressed={vistaConciertos === segmento.valor}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                vistaConciertos === segmento.valor
                  ? 'bg-accent text-white shadow-elevation-1'
                  : 'text-ink-muted hover:text-ink dark:text-[#c6c5cf] dark:hover:text-[#e3e2e9]'
              }`}
            >
              {segmento.etiqueta}
            </button>
          ))}
        </div>

        {/* En mobile alternamos mapa/lista con un control segmentado sticky; en PC se ven ambos. */}
        <div className="sticky top-16 z-30 mb-4 flex gap-1 rounded-full bg-[#f4f4f6]/85 p-1 shadow-elevation-1 backdrop-blur-xl lg:hidden dark:bg-[#1c1f24]/85">
          {botonTab('mapa', <FiMapPin />, 'Mapa')}
          {botonTab('lista', <FiList />, `Lista (${cantidadConciertos})`)}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] xl:grid-cols-[1.3fr_1fr]">
          <div
            ref={refColumnaMapa}
            className={`${
              vista === 'mapa' ? 'flex' : 'hidden'
            } z-0 h-[55vh] min-h-[380px] overflow-hidden rounded-3xl shadow-elevation-3 lg:sticky lg:top-24 lg:h-[calc(100vh-8.5rem)] lg:min-h-0 lg:flex`}
          >
            <Mapa
              centro={centroMapa}
              conciertos={conciertos}
              ubicacionUsuario={filtros.ubicacionActual}
              radioKm={filtros.radio}
              seleccionadoId={conciertoSeleccionado?.id ?? null}
            />
          </div>

          <div className={`${vista === 'lista' ? 'block' : 'hidden'} lg:block`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink dark:text-[#e3e2e9]">
                {cargando ? 'Cargando conciertos…' : `Conciertos (${cantidadConciertos})`}
              </h2>
            </div>

            {error ? (
              <EstadoVacio tipo="error" />
            ) : cargando ? (
              <div className="space-y-4" aria-label="Cargando conciertos">
                {Array.from({ length: 4 }).map((_, indice) => (
                  <div
                    key={indice}
                    className="h-40 animate-pulse rounded-3xl bg-black/5 dark:bg-white/5"
                  />
                ))}
              </div>
            ) : conciertos.length === 0 ? (
              vistaConciertos === 'favoritos' ? (
                <EstadoVacio
                  tipo="sin-resultados"
                  titulo="Todavía no guardaste favoritos"
                  subtitulo="Tocá el corazón en una tarjeta para guardar el concierto y verlo acá."
                  onReiniciar={reiniciarFiltros}
                />
              ) : vistaConciertos === 'siguiendo' ? (
                <EstadoVacio
                  tipo="sin-resultados"
                  titulo="Todavía no seguís artistas"
                  subtitulo="Tocá «Seguir» en una tarjeta y vas a recibir avisos cuando tengan nuevos conciertos."
                  onReiniciar={reiniciarFiltros}
                />
              ) : (
                <EstadoVacio tipo="sin-resultados" onReiniciar={reiniciarFiltros} />
              )
            ) : (
              <div className="space-y-4 pr-1 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
                {conciertos.map((concierto) => (
                  <TarjetaConcierto
                    key={concierto.id}
                    concierto={concierto}
                    seleccionado={conciertoSeleccionado?.id === concierto.id}
                    onVerEnMapa={seleccionarConcierto}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <PieDePagina />
    </div>
  )
}