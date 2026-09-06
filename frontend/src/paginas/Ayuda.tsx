import {
  FiBell,
  FiCrosshair,
  FiFilter,
  FiHeart,
  FiLayers,
  FiLogIn,
  FiMapPin,
  FiMoon,
  FiRadio,
  FiSearch,
  FiUserPlus,
} from 'react-icons/fi'
import Encabezado from '../componentes/Encabezado'
import PieDePagina from '../componentes/PieDePagina'
import EnlaceBoton from '../componentes/EnlaceBoton'

const pasos = [
  {
    icono: <FiMapPin />,
    titulo: 'Explorá el mapa',
    texto:
      'Cada concierto se muestra con un marcador en el mapa. Tocá un marcador para ver el detalle y usar los botones de la tarjeta.',
  },
  {
    icono: <FiSearch />,
    titulo: 'Buscá por artista',
    texto:
      'En el panel de filtros escribí el nombre de un artista y elegí la coincidencia de las sugerencias (con las flechas del teclado y Enter). Si lo dejás vacío, se muestran todos.',
  },
  {
    icono: <FiCrosshair />,
    titulo: 'Conciertos cerca tuyo',
    texto:
      'Activá el botón "Cerca de mí" y elegí un radio (hasta 50 km). Verás solo los conciertos que están dentro de esa distancia de tu ubicación.',
  },
  {
    icono: <FiLogIn />,
    titulo: 'Creá tu cuenta',
    texto:
      'Registrate con tu nombre, correo y contraseña para guardar favoritos. La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y carácter especial. Tardás menos de un minuto.',
  },
  {
    icono: <FiHeart />,
    titulo: 'Guardá favoritos',
    texto:
      'Tocá el corazón en una tarjeta para guardar el concierto. Encontrarás todos tus favoritos en el filtro "Mis favoritos".',
  },
  {
    icono: <FiUserPlus />,
    titulo: 'Seguí artistas',
    texto:
      'Tocá "Seguir" en cualquier tarjeta para seguir al artista. Sus próximos conciertos quedan en el segmento "Siguiendo" y vas a recibir avisos cuando sumen fechas nuevas.',
  },
  {
    icono: <FiBell />,
    titulo: 'Recibí novedades',
    texto:
      'La campana de la barra superior muestra las novedades de los artistas que seguís. Tocá una para verla en el mapa y marcá todas como leídas con un toque.',
  },
  {
    icono: <FiLayers />,
    titulo: 'Estilos del mapa',
    texto:
      'Con el control superior derecho del mapa elegís el estilo: automático (sigue tu tema), claro u oscuro. Tu preferencia queda recordada.',
  },
  {
    icono: <FiFilter />,
    titulo: 'Filtros y distribución',
    texto:
      'El panel de filtros se pliega y despliega. El buscador de artista sugiere coincidencias mientras escribís. En el celular, el control fijo del tope alterna entre mapa y lista para que no tengas que volver a scrollear.',
  },
  {
    icono: <FiRadio />,
    titulo: 'Precios y entradas',
    texto:
      'Cada tarjeta muestra si hay entradas disponibles o si el evento está agotado, y te lleva a la página oficial para comprar.',
  },
  {
    icono: <FiMoon />,
    titulo: 'Modo oscuro',
    texto:
      'Cambiá el tema con el botón de luna/sol en la barra superior. Tu preferencia queda guardada.',
  },
]

export default function Ayuda() {
  return (
    <div className="flex min-h-screen flex-col">
      <Encabezado />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <section className="rounded-3xl border border-black/5 bg-surface p-6 shadow-elevation-1 sm:p-8 dark:border-white/10 dark:bg-[#2b2e33]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-surface px-3.5 py-1.5 text-xs font-semibold text-primary dark:bg-primary/15">
            Cómo usar la app
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-[#e3e2e9]">
            Guía de uso
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-muted dark:text-[#c6c5cf]">
            En pocos pasos vas a sacarle el jugo a BAsónicos. Toda la guía también está
            disponible en{' '}
            <code className="rounded bg-black/5 px-1.5 py-0.5 text-sm dark:bg-white/10">
              COMO_USAR.md
            </code>{' '}
            en el repositorio.
          </p>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {pasos.map((paso, indice) => (
            <article
              key={indice}
              className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-surface p-5 shadow-elevation-1 dark:bg-[#2b2e33]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-surface text-xl text-primary dark:bg-primary/15">
                {paso.icono}
              </div>
              <h2 className="font-display text-base font-semibold text-ink dark:text-[#e3e2e9]">
                {paso.titulo}
              </h2>
              <p className="text-sm leading-relaxed text-ink-muted dark:text-[#c6c5cf]">
                {paso.texto}
              </p>
            </article>
          ))}

          <article className="flex flex-col items-start justify-center gap-3 rounded-3xl border border-primary/20 bg-primary-surface/50 p-5 shadow-elevation-1 sm:col-span-2 dark:bg-primary/10">
            <h2 className="font-display text-base font-semibold text-ink dark:text-[#e3e2e9]">
              Empezá ahora
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted dark:text-[#c6c5cf]">
              Creá tu cuenta o iniciá sesión para guardar favoritos y seguir artistas, y después
              usá el mapa para explorar los conciertos.
            </p>
            <div className="flex flex-wrap gap-2">
              <EnlaceBoton to="/registro">Crear cuenta</EnlaceBoton>
              <EnlaceBoton variante="contorno" to="/login">
                Iniciar sesión
              </EnlaceBoton>
              <EnlaceBoton variante="texto" to="/">
                Volver al inicio
              </EnlaceBoton>
            </div>
          </article>
        </div>
      </main>

      <PieDePagina />
    </div>
  )
}