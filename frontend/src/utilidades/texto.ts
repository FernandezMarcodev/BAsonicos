export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function artistaDuplicadoEnTitulo(
  nombre: string | null | undefined,
  artista: string | null | undefined,
): boolean {
  const nombreNorm = normalizarTexto(nombre)
  const artistaNorm = normalizarTexto(artista)
  return artistaNorm.length > 0 && nombreNorm === artistaNorm
}