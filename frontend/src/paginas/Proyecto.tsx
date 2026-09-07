import { FiCode, FiExternalLink, FiGithub, FiMapPin, FiBell, FiUsers } from 'react-icons/fi'
import EnlaceBoton from '../componentes/EnlaceBoton'
import PieDePagina from '../componentes/PieDePagina'

const STACK = [
  'Go (Gin)',
  'TypeScript',
  'React + Vite',
  'Tailwind CSS',
  'PostgreSQL + PostGIS',
  'Leaflet',
  'Python (scrapers)',
  'JWT',
  'Web Push',
  'PWA',
]

function TarjetaCaracteristica({
  icono,
  titulo,
  descripcion,
}: {
  icono: React.ReactNode
  titulo: string
  descripcion: string
}) {
  return (
    <article className="rounded-3xl border border-black/5 bg-surface p-6 shadow-elevation-1 dark:border-white/10 dark:bg-[#2b2e33]">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-surface text-2xl text-primary dark:bg-primary/15">
        {icono}
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight text-ink dark:text-[#e3e2e9]">
        {titulo}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted dark:text-[#c6c5cf]">{descripcion}</p>
    </article>
  )
}

export default function Proyecto() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f6] dark:bg-[#24262b]">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f4f4f6]/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#24262b]/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/" className="flex items-center gap-2.5" aria-label="BAsónicos">
            <img src="/logo.svg" alt="BAsónicos" className="h-9 w-9 rounded-xl shadow-elevation-1" />
            <span className="font-display text-lg font-semibold tracking-tight text-ink dark:text-[#e3e2e9]">
              BAsónicos
            </span>
          </a>
          <div className="flex items-center gap-2">
            <EnlaceBoton href="https://github.com/FernandezMarcodev/BAsonicos" variante="texto" className="px-3.5 py-2">
              <FiGithub className="text-lg" />
              <span className="hidden sm:inline">Código</span>
            </EnlaceBoton>
            <EnlaceBoton to="/app" className="px-4 py-2">
              <FiExternalLink className="text-base" />
              Abrir la app
            </EnlaceBoton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="animate-subir mx-auto max-w-3xl py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-surface px-3.5 py-1.5 text-xs font-semibold text-primary dark:bg-primary/15">
            <FiCode className="text-sm" />
            Proyecto open source de software
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-ink sm:text-6xl dark:text-[#e3e2e9]">
            BAsónicos
          </h1>
          <p className="mt-4 text-lg text-ink-muted dark:text-[#c6c5cf]">
            El mapa interactivo de conciertos del Gran Buenos Aires: reúne la grilla de{' '}
            <span className="font-medium text-ink dark:text-[#e3e2e9]">agendade.com.ar</span>, la geolocaliza
            y te permite buscar por artista o por cercanía a tu ubicación, con seguimiento de artistas y
            notificaciones push.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <EnlaceBoton to="/app" className="px-6 py-3">
              <FiMapPin className="text-base" />
              Abrir la app
            </EnlaceBoton>
            <EnlaceBoton
              href="https://github.com/FernandezMarcodev/BAsonicos"
              variante="contorno"
              className="px-6 py-3"
            >
              <FiGithub className="text-lg" />
              Ver el código
            </EnlaceBoton>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink dark:text-[#e3e2e9]">
            Qué hace
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <TarjetaCaracteristica
              icono={<FiMapPin />}
              titulo="Filtros por cercanía"
              descripcion="Todos los conciertos tienen coordenadas (PostGIS + Nominatim). Desde el navegador podés filtrar por radio en kilómetros alrededor de tu ubicación."
            />
            <TarjetaCaracteristica
              icono={<FiUsers />}
              titulo="Seguimiento de artistas"
              descripcion="Seguí a tus artistas favoritos y guardá conciertos. El backend detecta cuándo agregan una fecha nueva y te genera novedades."
            />
            <TarjetaCaracteristica
              icono={<FiBell />}
              titulo="Avisos push"
              descripcion="Suscribite y recibí una notificación push (PWA) cuando un artista que seguís sume un concierto nuevo."
            />
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink dark:text-[#e3e2e9]">
            Stack tecnológico
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-ink-muted dark:text-[#c6c5cf]">
            Arquitectura de tres capas con scrapers automatizados, API REST y frontend en tiempo real. Todo el
            código es abierto y no comercial.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {STACK.map((tecnologia) => (
              <li
                key={tecnologia}
                className="rounded-full border border-black/5 bg-surface px-4 py-2 text-sm font-medium text-ink shadow-elevation-1 dark:border-white/10 dark:bg-[#2b2e33] dark:text-[#e3e2e9]"
              >
                {tecnologia}
              </li>
            ))}
          </ul>
        </section>

        <section className="pb-12 sm:pb-16">
          <div className="rounded-3xl border border-primary/20 bg-primary-surface/50 p-6 sm:p-8 dark:bg-primary/10">
            <h2 className="font-display text-xl font-bold tracking-tight text-ink dark:text-[#e3e2e9]">
              Documentación
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted dark:text-[#c6c5cf]">
              Guía de uso dentro de la app, y arquitectura, modelo de datos y especificación de requisitos en el
              repositorio.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <EnlaceBoton to="/ayuda" variante="contorno">
                Cómo usar la app
              </EnlaceBoton>
              <EnlaceBoton to="/app" variante="contorno">
                Mapa de conciertos
              </EnlaceBoton>
            </div>
          </div>
        </section>
      </main>

      <PieDePagina />
    </div>
  )
}