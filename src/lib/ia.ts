// Redacción de sinopsis con IA (Claude, API de Anthropic).
//
// Reglas para que la sinopsis sea CORRECTA (acordadas en el plan de mejoras):
//  · Si hay material de las fuentes bibliográficas (descripción de Google
//    Books / Open Library, aunque venga en inglés), la IA se basa SOLO en él:
//    lo traduce, lo limpia de texto publicitario y lo recorta.
//  · Sin material, solo redacta si conoce la obra con seguridad; tiene
//    prohibido inventar trama, premios o datos. Si duda, contesta NO_SE y
//    el campo se queda vacío para rellenarlo a mano.
//  · Lo generado en lote se guarda como BORRADOR (sinopsis_borrador) y no se
//    publica hasta que JLG lo apruebe en /admin/sinopsis.
//
// Modelo: Haiku 4.5, el modelo pequeño de Claude — elegido por coste en el
// plan aprobado (~0,2 céntimos por sinopsis; toda la colección < 1 €).
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from 'astro:env/server';

const MODELO = 'claude-haiku-4-5';

export interface DatosParaSinopsis {
  titulo: string;
  autor: string;
  autores_extra?: string[];
  editorial?: string | null;
  anio?: number | null;
  categoria?: string | null;
  idioma?: string | null;
  /** Descripción traída por las fuentes bibliográficas (puede venir en inglés). */
  material?: string | null;
}

export type ResultadoSinopsis =
  | { ok: true; sinopsis: string }
  /** desconocido = la IA no conoce el libro y prefiere no inventar. */
  | { ok: false; motivo: 'sin-clave' | 'desconocido' | 'error'; detalle?: string };

/** ¿Está configurada la clave de la API? (Sin ella, la función se desactiva.) */
export function hayClaveIa(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}

function construirPeticion(d: DatosParaSinopsis): string {
  const ficha = [
    `Título: ${d.titulo}`,
    `Autor: ${[d.autor, ...(d.autores_extra ?? [])].filter(Boolean).join(', ')}`,
    d.editorial ? `Editorial: ${d.editorial}` : null,
    d.anio ? `Año: ${d.anio}` : null,
    d.categoria ? `Categoría: ${d.categoria}` : null,
    d.idioma ? `Idioma del ejemplar: ${d.idioma}` : null,
  ].filter(Boolean).join('\n');

  const material = d.material?.trim()
    ? `\nMaterial de las fuentes bibliográficas (puede estar en otro idioma o traer texto publicitario):\n"""\n${d.material.trim()}\n"""`
    : '\nNo hay material de las fuentes para este libro.';

  return `Redacta la sinopsis para la ficha de este libro del catálogo:

${ficha}
${material}

Reglas:
- Entre 60 y 100 palabras, en español neutro, tono sobrio de contracubierta de una librería seria. Sin frases de marketing ("imprescindible", "obra maestra"…), sin desvelar el final, sin opiniones.
- Si hay material de las fuentes: básate SOLO en él (tradúcelo si hace falta, límpialo y recórtalo). No añadas datos que no estén en el material.
- Si NO hay material, pregúntate primero: ¿identificas esta obra concreta? Muchas lo son de sobra (clásicos, superventas internacionales, manuales y obras de referencia célebres): en ese caso redacta con lo que sabes con certeza de la obra (tema, planteamiento, contexto), quedándote en lo general antes que arriesgar detalles. No la confundas con otra obra del mismo autor.
- Tienes prohibido inventar trama, premios, fechas o datos concretos de los que no estés seguro.
- Si es una publicación periódica o un anuario (p. ej. un anuario de ajedrez), describe en qué consiste la serie y qué recoge cada entrega.
- Responde exactamente NO_SE únicamente si de verdad no identificas la obra o apenas sabes nada de ella.
- Responde SOLO con la sinopsis (o NO_SE), sin comillas, sin título y sin preámbulos.`;
}

/** Redacta (o limpia/traduce) la sinopsis de un libro. Nunca lanza: devuelve el motivo. */
export async function redactarSinopsis(datos: DatosParaSinopsis): Promise<ResultadoSinopsis> {
  if (!ANTHROPIC_API_KEY) return { ok: false, motivo: 'sin-clave' };

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  try {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 400,
      temperature: 0.3,
      system:
        'Eres el bibliotecario de «La librería de JL», un catálogo personal de libros. ' +
        'Redactas sinopsis breves y veraces para las fichas del catálogo. ' +
        'La fiabilidad importa más que la completitud: nunca inventas.',
      messages: [{ role: 'user', content: construirPeticion(datos) }],
    });

    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!texto || texto.toUpperCase().startsWith('NO_SE')) {
      return { ok: false, motivo: 'desconocido' };
    }
    return { ok: true, sinopsis: texto };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, motivo: 'error', detalle: 'La clave ANTHROPIC_API_KEY no es válida.' };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, motivo: 'error', detalle: 'Demasiadas peticiones seguidas; espera un momento.' };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, motivo: 'error', detalle: `Error de la API (${e.status}).` };
    }
    return { ok: false, motivo: 'error', detalle: 'No se pudo conectar con la API.' };
  }
}
