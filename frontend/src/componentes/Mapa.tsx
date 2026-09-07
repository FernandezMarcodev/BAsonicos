import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import { FiMoon, FiRefreshCw, FiSun } from 'react-icons/fi'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../mapa.css'
import { useTema } from '../contexto/TemaContext'
import type { Concierto, PuntoUsuario } from '../tipos'

const AMBA_MIN_LAT = -35.15
const AMBA_MAX_LAT = -34.2
const AMBA_MIN_LNG = -58.95
const AMBA_MAX_LNG = -57.7
const CENTRO_DEFECTO: [number, number] = [-34.6037, -58.3816]

const URL_TILES = import.meta.env.VITE_OSM_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

type EstiloMapa = 'auto' | 'claro' | 'oscuro'

const CLAVE_ESTILO = 'mapaEstilo'

function leerEstilo(): EstiloMapa {
  try {
    const guardado = localStorage.getItem(CLAVE_ESTILO)
    if (guardado === 'claro' || guardado === 'oscuro') return guardado
  } catch {
    /* sin almacenamiento */
  }
  return 'auto'
}

interface CentroMapa {
  lat: number
  lng: number
  zoom?: number
}

interface Grupo {
  lat: number
  lng: number
  conciertos: Concierto[]
}

interface Props {
  centro: CentroMapa | null
  conciertos: Concierto[]
  ubicacionUsuario: PuntoUsuario | null
  radioKm: number
  seleccionadoId: number | null
}

function enAmba(lat: number, lng: number): boolean {
  return lat >= AMBA_MIN_LAT && lat <= AMBA_MAX_LAT && lng >= AMBA_MIN_LNG && lng <= AMBA_MAX_LNG
}

function formatearFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const partes = fecha.split('-')
  if (partes.length !== 3) return fecha
  const [, mes, dia] = partes
  return `${Number(dia)}/${mes}`
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textoFechaHora(concierto: Concierto): string {
  const partes = [formatearFechaCorta(concierto.fecha), concierto.hora?.slice(0, 5)]
  const resultado = partes.filter((parte) => parte && parte.length > 0).join(' · ')
  return resultado || '—'
}

function iconoParaGrupo(grupoConciertos: Concierto[], seleccionado: boolean): L.DivIcon {
  const todosAgotados = grupoConciertos.every((concierto) => concierto?.isAgotado)
  const clase = todosAgotados ? 'agotado' : 'disponible'
  const html = `<div class="marcador-concierto ${clase} ${seleccionado ? 'seleccionado' : ''}"><span class="marcador-concierto__nucleo"></span></div>`
  return L.divIcon({ html, className: '', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] })
}

// Recalcula los panes de Leaflet cuando cambia el tamaño del contenedor o cuando
// pasa de oculto (vista lista en mobile) a visible. Sin esto, en mobile los tiles
// quedan mal dimensionados y se "derraman" superponiéndose con el contenido.
function ObservarTamanoMapa() {
  const mapa = useMap()
  useEffect(() => {
    const contenedor = mapa.getContainer()
    const invalidar = () => mapa.invalidateSize()
    let id: number
    const aplazado = () => {
      invalidar()
      id = window.setTimeout(aplazado, 2000)
    }
    const observador = new ResizeObserver(invalidar)
    observador.observe(contenedor)
    id = window.setTimeout(aplazado, 300)
    return () => {
      observador.disconnect()
      window.clearTimeout(id)
    }
  }, [mapa])
  return null
}

function CambiarVistaMapa({ centro }: { centro: CentroMapa | null }) {
  const mapa = useMap()
  useEffect(() => {
    if (!centro) return
    mapa.closePopup()
    mapa.setView([centro.lat, centro.lng], centro.zoom || 11, { animate: true, duration: 1 })
  }, [centro, mapa])
  return null
}

function AjustarVistaRadio({
  ubicacionUsuario,
  radioKm,
}: {
  ubicacionUsuario: PuntoUsuario | null
  radioKm: number
}) {
  const mapa = useMap()
  useEffect(() => {
    if (!ubicacionUsuario) return
    const ranura = 2.4
    const visibleRadio = Math.max(radioKm * ranura, 3)
    const zoom = Math.max(
      Math.min(Math.ceil(Math.log2((6491.497 * Math.cos((ubicacionUsuario.lat * Math.PI) / 180)) / visibleRadio)), 15),
      5,
    )
    mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], zoom, {
      animate: true,
      duration: 1,
    })
  }, [ubicacionUsuario, radioKm, mapa])
  return null
}

function AjustarVistaInicial({
  grupos,
  ubicacionUsuario,
}: {
  grupos: Grupo[]
  ubicacionUsuario: PuntoUsuario | null
}) {
  const mapa = useMap()
  const yaAjustado = useRef(false)

  useEffect(() => {
    if (yaAjustado.current || ubicacionUsuario || grupos.length === 0) return
    yaAjustado.current = true
    const bounds = L.latLngBounds(grupos.map((g) => [g.lat, g.lng] as [number, number]))
    mapa.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
  }, [grupos, mapa, ubicacionUsuario])

  return null
}

function ControlarPopupSeleccion({
  seleccionadoId,
  grupos,
}: {
  seleccionadoId: number | null
  grupos: Grupo[]
}) {
  const mapa = useMap()
  const objetivoFly = useRef<{ lat: number; lng: number } | null>(null)
  const popupTemporal = useRef<L.Popup | null>(null)

  useEffect(() => {
    if (seleccionadoId === null) return
    const grupo = grupos.find((g) => g.conciertos.some((c) => c.id === seleccionadoId))
    if (!grupo) return

    if (objetivoFly.current?.lat !== grupo.lat || objetivoFly.current?.lng !== grupo.lng) {
      mapa.flyTo([grupo.lat, grupo.lng], 15, { animate: true, duration: 0.8 })
    }
    objetivoFly.current = { lat: grupo.lat, lng: grupo.lng }

    const abrirPopup = () => {
      try {
        const lugar = grupo.conciertos[0]?.ubicacion_detalle?.nombre
        const contenido = grupo.conciertos
          .map((concierto) => {
            const colorEstado = concierto.isAgotado ? '#ff453a' : '#32d74b'
            return (
              '<div style="display:flex;align-items:center;gap:8px;font-size:12px;">' +
              `<span style="width:8px;height:8px;border-radius:50%;background:${colorEstado};flex-shrink:0;"></span>` +
              `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escaparHtml(concierto.nombre)}</span>` +
              `<span style="margin-left:auto;color:#c6c5cf;flex-shrink:0;">${escaparHtml(textoFechaHora(concierto))}</span>` +
              '</div>'
            )
          })
          .join('')
        const html =
          '<div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;min-width:264px;display:flex;flex-direction:column;gap:6px;">' +
          `<span style="font-size:14px;font-weight:700;">${grupo.conciertos.length} concierto${grupo.conciertos.length === 1 ? '' : 's'}</span>` +
          (lugar
            ? `<span style="font-size:12px;font-weight:600;color:#8e8e93;padding-bottom:2px;">${escaparHtml(lugar)}</span>`
            : '') +
          contenido +
          '</div>'

        if (popupTemporal.current) {
          mapa.removeLayer(popupTemporal.current)
        }
        popupTemporal.current = L.popup()
          .setLatLng([grupo.lat, grupo.lng])
          .setContent(html)
          .openOn(mapa)
      } catch (error) {
        console.warn('[Mapa] No se pudo abrir el popup del grupo', grupo, error)
      }
    }

    const alVolar = window.setTimeout(abrirPopup, 850)
    return () => window.clearTimeout(alVolar)
  }, [seleccionadoId, grupos, mapa])

  useEffect(() => {
    return () => {
      if (popupTemporal.current) {
        mapa.removeLayer(popupTemporal.current)
      }
    }
  }, [mapa])

  return null
}

function SelectorEstiloMapa({ valor, alCambiar }: { valor: EstiloMapa; alCambiar: (estilo: EstiloMapa) => void }) {
  const opciones: { estilo: EstiloMapa; icono: ReactNode; etiqueta: string }[] = [
    { estilo: 'auto', icono: <FiRefreshCw />, etiqueta: 'Automático (según tema)' },
    { estilo: 'claro', icono: <FiSun />, etiqueta: 'Mapa claro' },
    { estilo: 'oscuro', icono: <FiMoon />, etiqueta: 'Mapa oscuro' },
  ]

  return (
    <div className="absolute right-3 top-3 z-[1000] flex gap-1 rounded-full border border-black/10 bg-white/90 p-1 shadow-elevation-2 backdrop-blur dark:border-white/10 dark:bg-[#36393f]/90">
      {opciones.map((opcion) => (
        <button
          key={opcion.estilo}
          type="button"
          onClick={() => alCambiar(opcion.estilo)}
          aria-pressed={valor === opcion.estilo}
          aria-label={opcion.etiqueta}
          title={opcion.etiqueta}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
            valor === opcion.estilo
              ? 'bg-primary text-white shadow-elevation-1'
              : 'bg-transparent text-ink-muted hover:bg-black/5 hover:text-ink dark:text-[#c6c5cf] dark:hover:bg-white/10 dark:hover:text-white'
          }`}
        >
          {opcion.icono}
        </button>
      ))}
    </div>
  )
}

function ContenidoPopup({ grupo }: { grupo: Grupo }) {
  const lugar = grupo.conciertos[0]?.ubicacion_detalle?.nombre
  return (
    <div className="min-w-64 space-y-1.5">
      <p className="font-display text-sm font-bold text-ink dark:text-[#e3e2e9]">
        {grupo.conciertos.length} concierto{grupo.conciertos.length === 1 ? '' : 's'}
      </p>
      {lugar && (
        <p className="pb-0.5 text-xs font-semibold text-ink-muted dark:text-[#c6c5cf]">{lugar}</p>
      )}
      {grupo.conciertos.map((concierto) => (
        <div key={concierto.id} className="flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              concierto.isAgotado ? 'bg-danger' : 'bg-success'
            }`}
          />
          <span className="truncate text-ink dark:text-[#e3e2e9]">{concierto.nombre}</span>
          <span className="ml-auto shrink-0 text-ink-muted dark:text-[#c6c5cf]">
            {textoFechaHora(concierto)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Mapa({
  centro,
  conciertos,
  ubicacionUsuario,
  radioKm,
  seleccionadoId,
}: Props) {
  const { modoOscuro } = useTema()
  const [estiloMapa, setEstiloMapa] = useState<EstiloMapa>(leerEstilo)

  const grupos = useMemo<Grupo[]>(() => {
    const agrupados = new Map<string, Grupo>()
    for (const concierto of conciertos) {
      const col = concierto.ubicacion_detalle?.coordenadas
      if (!col || col.length !== 2) continue
      const lat = col[1]
      const lng = col[0]
      if (!enAmba(lat, lng)) continue
      const clave = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const previo = agrupados.get(clave)
      if (previo) {
        previo.conciertos.push(concierto)
      } else {
        agrupados.set(clave, { lat, lng, conciertos: [concierto] })
      }
    }
    return Array.from(agrupados.values())
  }, [conciertos])

  const usarOscuro = estiloMapa === 'oscuro' || (estiloMapa === 'auto' && modoOscuro)

  function cambiarEstilo(estilo: EstiloMapa) {
    setEstiloMapa(estilo)
    try {
      localStorage.setItem(CLAVE_ESTILO, estilo)
    } catch {
      /* sin almacenamiento */
    }
  }

  return (
    <div className={`relative z-0 h-full w-full ${usarOscuro ? 'tiles-oscuro' : ''}`}>
      <MapContainer
        center={CENTRO_DEFECTO}
        zoom={11}
        className="h-full w-full"
        zoomControl={false}
        maxZoom={20}
        attributionControl
      >
      <TileLayer
        url={URL_TILES}
        attribution={ATRIBUCION}
        maxNativeZoom={19}
        maxZoom={20}
      />

      <CambiarVistaMapa centro={centro} />
      <ObservarTamanoMapa />
      <AjustarVistaRadio ubicacionUsuario={ubicacionUsuario} radioKm={radioKm} />
      <AjustarVistaInicial grupos={grupos} ubicacionUsuario={ubicacionUsuario} />
      <ControlarPopupSeleccion seleccionadoId={seleccionadoId} grupos={grupos} />
      <ZoomControl position="bottomright" />
      <SelectorEstiloMapa valor={estiloMapa} alCambiar={cambiarEstilo} />

      {ubicacionUsuario && (
        <>
          <Circle
            center={[ubicacionUsuario.lat, ubicacionUsuario.lng]}
            radius={radioKm * 1000}
            pathOptions={{
              color: '#0a84ff',
              weight: 1.5,
              opacity: 0.6,
              fillColor: '#0a84ff',
              fillOpacity: 0.12,
            }}
          />
          <Marker
            position={[ubicacionUsuario.lat, ubicacionUsuario.lng]}
            icon={L.divIcon({
              html: '<div class="marcador-usuario"></div>',
              className: '',
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Popup>
              <span className="text-xs font-medium text-ink dark:text-[#e3e2e9]">
                Tu ubicación
              </span>
            </Popup>
          </Marker>
        </>
      )}

      {grupos.map((grupo) => {
        const clave = `${grupo.lat},${grupo.lng}`
        const seleccionado = grupo.conciertos.some((concierto) => concierto.id === seleccionadoId)
        return (
          <Marker
            key={clave}
            position={[grupo.lat, grupo.lng]}
            icon={iconoParaGrupo(grupo.conciertos, seleccionado)}
          >
            <Popup>
              <ContenidoPopup grupo={grupo} />
            </Popup>
          </Marker>
        )
      })}
      </MapContainer>
    </div>
  )
}