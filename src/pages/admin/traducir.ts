import type { APIRoute } from 'astro';
import { obtenerLibroPorId, actualizarLibro } from '../../lib/libros';
import { traducirSinopsis, hayClaveIa } from '../../lib/ia';

// Protegido por el middleware (cuelga de /admin). Traduce al inglés la sinopsis
// de UN libro y la guarda en `sinopsis_en`, junto con una copia del texto
// español del que salió (`sinopsis_en_de`): si mañana cambia la sinopsis en
// español, esa copia deja de coincidir y el panel sabe que hay que rehacerla.
// La página /admin/traducciones llama a este endpoint libro a libro.
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (!hayClaveIa()) return json({ resultado: 'sin-clave' }, 503);

  const body: any = await request.json().catch(() => null);
  if (!body?.id) return json({ resultado: 'error', detalle: 'Petición mal formada.' }, 400);

  const libro = await obtenerLibroPorId(String(body.id));
  if (!libro) return json({ resultado: 'error', detalle: 'Libro no encontrado.' }, 404);

  const sinopsis = libro.sinopsis?.trim();
  if (!sinopsis) {
    return json({ resultado: 'error', detalle: 'Este libro todavía no tiene sinopsis en español.' });
  }

  const r = await traducirSinopsis({ titulo: libro.titulo, autor: libro.autor, sinopsis });
  if (!r.ok) return json({ resultado: r.motivo, detalle: r.detalle ?? null });

  // Guardamos la traducción y el original del que salió, en la misma operación.
  await actualizarLibro(libro.id, { sinopsis_en: r.texto, sinopsis_en_de: sinopsis });
  return json({ resultado: 'ok', texto: r.texto });
};
