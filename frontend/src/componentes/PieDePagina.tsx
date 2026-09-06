import { Link } from 'react-router-dom'
import { FiGithub, FiMail } from 'react-icons/fi'

const CORREO = 'fernandezmarcovalentin@gmail.com'

export default function PieDePagina() {
  return (
    <footer className="mt-16 bg-[#1c1f24] py-8 text-center text-sm text-[#c6c5cf]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 sm:flex-row sm:gap-6">
        <p>BAsónicos · Buenos Aires y alrededores</p>
        <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden="true" />
        <a
          href={`mailto:${CORREO}`}
          className="inline-flex items-center gap-1.5 text-[#c6c5cf] transition-colors hover:text-white"
        >
          <FiMail className="text-base" aria-hidden="true" />
          {CORREO}
        </a>
        <a
          href="https://github.com/FernandezMarcodev/BAsonicos"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[#c6c5cf] transition-colors hover:text-white"
        >
          <FiGithub className="text-base" aria-hidden="true" />
          GitHub
        </a>
        <Link to="/ayuda" className="transition-colors hover:text-white">
          Cómo usar la app
        </Link>
      </div>
    </footer>
  )
}