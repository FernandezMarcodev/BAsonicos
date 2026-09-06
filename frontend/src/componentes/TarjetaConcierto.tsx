import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiHeart, FiPlus } from 'react-icons/fi'
import Boton from './Boton'
import EnlaceBoton from './EnlaceBoton'
import { useAuth } from '../contexto/AuthContext'
import { useFavoritos } from '../contexto/FavoritosContext'
import { useSeguidos } from '../contexto/SeguidosContext'
import { artistaDuplicadoEnTitulo } from '../utilidades/texto'
import type { Concierto } from '../tipos'

interface Props {
  concierto: Concierto
  seleccionado: boolean
  onVerEnMapa: (concierto: Concierto) => void
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Fecha a confirmar'
  const partes = fecha.split('-')
  if (partes.length !== 3) return fecha
  const [anio, mes, dia] = partes
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const indice = Number(mes) - 1
  const nombreMes = meses[indice] ?? mes
  return `${Number(dia)} de ${nombreMes} de ${anio}`
}

export default function TarjetaConcierto({ concierto, seleccionado, onVerEnMapa }: Props) {
  const { usuario } = useAuth()
  const { esFavorito, alternarFavorito } = useFavoritos()
  const { esSeguido, seguir, dejarDeSeguir } = useSeguidos()
  const navegar = useNavigate()
  const [latido, setLatido] = useState(false)

  const tieneCoordenadas = Boolean(
    concierto.ubicacion_detalle?.coordenadas && concierto.ubicacion_detalle.coordenadas.length === 2,
  )
  const urlMaps = concierto.ubicacion_detalle?.url_maps || null
  const urlEvento = concierto.url_evento
  const favorito = esFavorito(concierto.id)
  const seguido = esSeguido(concierto.artista)
  const tieneArtista = Boolean(concierto.artista?.trim())
  const artistaRepetido = artistaDuplicadoEnTitulo(concierto.nombre, concierto.artista)

  function manejarFavorito() {
    if (!usuario) {
      navegar('/login')
      return
    }
    setLatido(true)
    window.setTimeout(() => setLatido(false), 500)
    void alternarFavorito(concierto)
  }

  function manejarSeguir() {
    if (!usuario) {
      navegar('/login')
      return
    }
    if (seguido) {
      void dejarDeSeguir(concierto.artista)
    } else {
      void seguir(concierto.artista)
    }
  }

  return (
    <article
      className={`flex flex-col gap-4 rounded-3xl border bg-surface p-5 shadow-elevation-1 transition-all hover:shadow-elevation-3 dark:bg-[#2b2e33] ${
        seleccionado
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-black/5 dark:border-white/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight tracking-tight text-ink dark:text-[#e3e2e9]">
            {concierto.nombre}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {tieneArtista && !artistaRepetido && (
              <p className="text-sm font-medium text-primary">{concierto.artista}</p>
            )}
            {tieneArtista && (
              <button
                onClick={manejarSeguir}
                aria-pressed={seguido}
                aria-label={
                  usuario
                    ? seguido
                      ? `Dejar de seguir a ${concierto.artista}`
                      : `Seguir a ${concierto.artista}`
                    : 'Ingresá para seguir artistas'
                }
                title={
                  usuario
                    ? seguido
                      ? 'Dejar de seguir'
                      : 'Seguir artista'
                    : 'Ingresá para seguir artistas'
                }
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                  seguido
                    ? 'bg-accent text-white'
                    : 'border border-accent/40 text-accent hover:bg-accent/10'
                }`}
              >
                {seguido ? <FiCheck className="text-sm" /> : <FiPlus className="text-sm" />}
                {seguido ? 'Siguiendo' : 'Seguir'}
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={manejarFavorito}
            aria-label={
              favorito ? 'Quitar de favoritos' : usuario ? 'Guardar en favoritos' : 'Ingresar para guardar favoritos'
            }
            aria-pressed={favorito}
            title={usuario ? (favorito ? 'Quitar de favoritos' : 'Guardar en favoritos') : 'Ingresá para guardar favoritos'}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition-colors ${
              favorito
                ? 'bg-danger/10 text-danger'
                : 'bg-black/5 text-ink-muted hover:bg-black/10 hover:text-danger dark:bg-white/10 dark:text-[#c6c5cf]'
            } ${latido ? 'animate-latido' : ''}`}
          >
            <FiHeart className={favorito ? 'fill-current' : ''} />
          </button>

          <div className="flex gap-2">
            {concierto.isAptoMenores && (
              <span className="rounded-full bg-primary-surface px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/15">
                Apto menores
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                concierto.isAgotado
                  ? 'bg-red-50 text-danger dark:bg-danger/15 dark:text-[#ff8a80]'
                  : 'bg-primary-surface text-primary dark:bg-primary/15'
              }`}
            >
              {concierto.isAgotado ? 'Agotado' : 'Disponible'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted dark:text-[#c6c5cf]">
        <span className="font-medium text-ink dark:text-[#e3e2e9]">
          {formatearFecha(concierto.fecha)}
        </span>
        {concierto.hora && <span>{concierto.hora.slice(0, 5)} hs</span>}
        {concierto.ubicacion_detalle?.nombre && (
          <span>{concierto.ubicacion_detalle.nombre}</span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Boton
          variante="tonal"
          onClick={() => onVerEnMapa(concierto)}
          disabled={!tieneCoordenadas}
          className="px-4"
        >
          Ver en mapa
        </Boton>
        {urlMaps && (
          <EnlaceBoton variante="contorno" href={urlMaps} className="px-4">
            Cómo llegar
          </EnlaceBoton>
        )}
        {urlEvento && (
          <EnlaceBoton href={urlEvento} className="px-4">
            Entradas
          </EnlaceBoton>
        )}
      </div>
    </article>
  )
}