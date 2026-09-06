import type { Concierto } from './tipos'

export const EVENTO_ENFOCAR_CONCIERTO = 'concierto:enfocar'

export function despacharEnfocarConcierto(concierto: Concierto) {
  window.dispatchEvent(new CustomEvent<Concierto>(EVENTO_ENFOCAR_CONCIERTO, { detail: concierto }))
}