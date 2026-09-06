export type Variante = 'primario' | 'tonal' | 'contorno' | 'texto'

export const estilosVariantes: Record<Variante, string> = {
  primario: 'bg-primary text-white shadow-elevation-1 hover:bg-primary-hover',
  tonal: 'bg-primary-surface text-primary hover:brightness-95 dark:bg-primary/15',
  contorno: 'border border-primary/30 text-primary hover:bg-primary-surface/60 dark:border-primary/50',
  texto: 'text-primary hover:bg-primary-surface/60 dark:hover:bg-primary/15',
}