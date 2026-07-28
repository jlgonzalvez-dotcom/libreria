// Distinguir dos ejemplares del mismo libro.
//
// En la colección hay títulos repetidos porque JLG tiene dos ediciones de la
// misma obra (p. ej. «Novela de ajedrez» de Zweig: Edelvives 2020 y Alma 2023).
// Con el título a secas, las dos fichas se llaman igual y parecen un error o un
// libro duplicado. Cuando eso pasa se añade la editorial y el año.
//
// Solo se añade a los que de verdad se repiten: poner "Cátedra, 2004" detrás de
// cada título ensuciaría el catálogo entero sin aportar nada.
import type { Libro } from './libros';
import { normalizarTexto } from './similitud';

/** Títulos que aparecen más de una vez en la colección (ya normalizados). */
export function titulosRepetidos(libros: Libro[]): Set<string> {
  const cuenta = new Map<string, number>();
  for (const l of libros) {
    const clave = normalizarTexto(l.titulo);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return new Set([...cuenta].filter(([, n]) => n > 1).map(([clave]) => clave));
}

/**
 * "Alma, 2023" para distinguir esta edición de la otra; `null` si el título no
 * se repite (que es el caso normal) o si no hay con qué distinguirla.
 */
export function distintivoEdicion(libro: Libro, repetidos: Set<string>): string | null {
  if (!repetidos.has(normalizarTexto(libro.titulo))) return null;
  const anio = libro.anio_publicacion ?? libro.anio;
  const partes = [editorialCorta(libro.editorial), anio ? String(anio) : null].filter(Boolean);
  return partes.length > 0 ? partes.join(', ') : null;
}

/**
 * La editorial en corto, solo para este distintivo: sin el "Editorial…" de
 * delante y sin el paréntesis del final. Así "Editorial Luis Vives (Edelvives)"
 * queda en "Luis Vives" y el título de la pestaña no acaba con paréntesis
 * dentro de paréntesis. El nombre completo sigue estando en la ficha.
 */
function editorialCorta(editorial?: string | null): string | null {
  const limpia = (editorial ?? '')
    .replace(/^\s*(editorial|ediciones|edit\.|ed\.)\s+/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  return limpia === '' ? null : limpia;
}
