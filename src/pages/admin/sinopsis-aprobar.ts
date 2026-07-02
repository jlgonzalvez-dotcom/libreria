import type { APIRoute } from 'astro';
import { obtenerLibroPorId, actualizarLibro } from '../../lib/libros';

// Protegido por el middleware (cuelga de /admin). Revisa un borrador de
// sinopsis generado por la IA:
//  · { id, accion: "aprobar", texto? } → publica el texto (editado o el
//    borrador tal cual) como sinopsis y vacía el borrador.
//  · { id, accion: "descartar" }       → vacía el borrador sin publicar nada.
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body: any = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  const accion = String(body?.accion ?? '');
  if (!id || !['aprobar', 'descartar'].includes(accion)) {
    return json({ error: 'Petición mal formada.' }, 400);
  }

  const libro = await obtenerLibroPorId(id);
  if (!libro) return json({ error: 'Libro no encontrado.' }, 404);

  if (accion === 'descartar') {
    await actualizarLibro(id, { sinopsis_borrador: null });
    return json({ ok: true });
  }

  const texto = String(body?.texto ?? libro.sinopsis_borrador ?? '').trim();
  if (!texto) return json({ error: 'No hay texto que aprobar.' }, 400);
  await actualizarLibro(id, { sinopsis: texto, sinopsis_borrador: null });
  return json({ ok: true });
};
