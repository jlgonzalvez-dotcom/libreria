// ¿Lo que hay guardado en el campo "sinopsis" es una sinopsis de verdad?
//
// Al cargar libros desde las fuentes bibliográficas se cuela a menudo texto que
// NO es una sinopsis: restos de ficha de catálogo ("Indice.", "Source title:…",
// "Includes index", "Traducción de: …") o el folleto publicitario de la
// editorial en inglés. Eso acaba publicado en la web como si fuera la sinopsis.
//
// Se usa en dos sitios, y en los dos importa:
//  · /admin/sinopsis → esos libros deben entrar en la cola de "Generar
//    borradores". Antes quedaban fuera para siempre, porque el criterio era
//    "tiene algo escrito en el campo sinopsis".
//  · /admin/sinopsis-generar → esa basura NO debe pasarse a la IA como material
//    de partida (si le das "Indice." como base, redacta a partir de eso).

/** Frases inequívocas de ficha de catálogo, vengan al principio o en medio. */
const RE_CATALOGO =
  /(^|\n)\s*[ií]\s*ndice\b|source title\s*:|includes? (an )?index|includes bibliograph|bibliographical references|translated from the|--\s*cover\.|^\s*traducci[óo]n de\s*:|^\s*an[áa]lisis de la obra\s*:/i;

/** Palabras muy frecuentes en español; si apenas aparecen, el texto no es español. */
const PALABRAS_ES = new Set([
  'de', 'la', 'el', 'que', 'y', 'en', 'los', 'las', 'un', 'una', 'por', 'con',
  'su', 'sus', 'del', 'al', 'se', 'es', 'para', 'como', 'más', 'obra', 'libro',
]);

/** Longitud mínima creíble: una sinopsis de la casa ronda los 400-700 caracteres. */
const MINIMO_CARACTERES = 200;

/**
 * `true` si el texto parece una sinopsis aprovechable; `false` si es un resto
 * de catálogo, un folleto en inglés o algo demasiado corto para ser una sinopsis.
 */
export function esSinopsisUtil(texto?: string | null): boolean {
  const t = (texto ?? '').trim();
  if (t.length < MINIMO_CARACTERES) return false;
  if (RE_CATALOGO.test(t)) return false;

  // ¿Está en español? Se mira la proporción de palabras funcionales españolas.
  // Un texto español baja rara vez del 15%; uno inglés no suele pasar del 5%
  // (algún "de" o "la" suelto de un nombre propio).
  const palabras = t.toLowerCase().match(/[a-záéíóúüñ]+/g) ?? [];
  if (palabras.length < 30) return false;
  const espanolas = palabras.filter((p) => PALABRAS_ES.has(p)).length;
  return espanolas / palabras.length >= 0.10;
}

/** Motivo por el que una sinopsis se considera inservible (para avisar en el panel). */
export function motivoSinopsisPobre(texto?: string | null): string | null {
  const t = (texto ?? '').trim();
  if (t === '') return null; // no hay nada: no es "pobre", simplemente falta
  if (esSinopsisUtil(t)) return null;
  if (RE_CATALOGO.test(t)) return 'restos de ficha de catálogo';
  if (t.length < MINIMO_CARACTERES) return 'demasiado corta para ser una sinopsis';
  return 'parece estar en inglés';
}
