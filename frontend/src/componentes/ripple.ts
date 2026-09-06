import { useCallback, type PointerEvent } from 'react'

/** Ripple de Material: agrega la clase `.auge` y posiciona la onda según el puntero. */
export function useRipple<T extends HTMLElement>() {
  return useCallback((evento: PointerEvent<T>) => {
    const elemento = evento.currentTarget
    const rect = elemento.getBoundingClientRect()
    const diametro = Math.max(rect.width, rect.height) * 2.2
    elemento.style.setProperty('--ripple-x', `${evento.clientX - rect.left - diametro / 2}px`)
    elemento.style.setProperty('--ripple-y', `${evento.clientY - rect.top - diametro / 2}px`)
    elemento.style.setProperty('--ripple-d', `${diametro}px`)
    elemento.classList.remove('auge')
    void elemento.offsetWidth
    elemento.classList.add('auge')
  }, [])
}