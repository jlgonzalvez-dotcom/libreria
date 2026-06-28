// Detección de libros duplicados o "sospechosamente parecidos" y normalización
// de texto para comparar. Lógica PURA, sin dependencias de servidor, para usarse
// en el navegador (aviso en el formulario de /admin) y también testeable.

import { mismoLibroIsbn } from './isbn';

/** Normaliza un texto para comparar: minúsculas, sin acentos (la ñ → n), sin
 *  signos de puntuación y con los espacios colapsados. Así "El Quijote",
 *  "el quijote." y "EL  QUIJOTE" se consideran iguales. */
export function normalizarTexto(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar marcas diacríticas (acentos)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // signos → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similitud 0..1 entre dos títulos por solapamiento de palabras (coeficiente de
 *  solapamiento: |A∩B| / min(|A|,|B|)). Da 1 cuando un título es el otro más un
 *  subtítulo (p. ej. "El Quijote" vs "El Quijote de la Mancha"). */
export function similitudTitulos(a: string, b: string): number {
  const ta = new Set(normalizarTexto(a).split(' ').filter(Boolean));
  const tb = new Set(normalizarTexto(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

export interface LibroRef {
  id: string;
  titulo: string;
  autor: string;
  isbn: string | null;
}

export interface Candidato {
  titulo: string;
  autor: string;
  isbn: string;
}

export interface Coincidencia {
  libro: LibroRef;
  /** 'alto' = casi seguro el mismo libro (pide confirmación al guardar).
   *  'medio' = parecido, solo informa. */
  nivel: 'alto' | 'medio';
  motivo: string;
}

const UMBRAL_PARECIDO = 0.85;

/** Busca en `libros` la coincidencia más fuerte con el libro que se está
 *  introduciendo. Devuelve null si nada se parece lo suficiente. */
export function detectarDuplicado(c: Candidato, libros: LibroRef[]): Coincidencia | null {
  const tCand = normalizarTexto(c.titulo);
  const aCand = normalizarTexto(c.autor);
  const isbnCand = (c.isbn || '').trim();
  const rango = { alto: 2, medio: 1 };
  let mejor: Coincidencia | null = null;

  for (const l of libros) {
    let m: Coincidencia | null = null;

    if (isbnCand && l.isbn && mismoLibroIsbn(isbnCand, l.isbn)) {
      m = { libro: l, nivel: 'alto', motivo: 'tiene el mismo ISBN' };
    } else if (tCand && normalizarTexto(l.titulo) === tCand) {
      m = aCand && normalizarTexto(l.autor) === aCand
        ? { libro: l, nivel: 'alto', motivo: 'tiene el mismo título y autor' }
        : { libro: l, nivel: 'medio', motivo: 'tiene el mismo título (con otro autor)' };
    } else if (
      tCand && aCand &&
      normalizarTexto(l.autor) === aCand &&
      similitudTitulos(c.titulo, l.titulo) >= UMBRAL_PARECIDO
    ) {
      m = { libro: l, nivel: 'medio', motivo: 'tiene un título casi idéntico y el mismo autor' };
    }

    if (m && (!mejor || rango[m.nivel] > rango[mejor.nivel])) mejor = m;
    if (mejor?.nivel === 'alto') break; // no hay nada más fuerte que buscar
  }

  return mejor;
}
