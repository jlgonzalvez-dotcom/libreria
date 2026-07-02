import type { APIRoute } from 'astro';
import { obtenerLibroPorId, actualizarLibro } from '../../lib/libros';

// Protegido por el middleware (cuelga de /admin). Asigna (o quita, si viene
// vacía) la ubicación física de un libro. Lo usa el "modo estantería"
// (/admin/ubicaciones) para rellenar ubicaciones en lote, clic a clic.
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body: any = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return json({ error: 'Petición mal formada.' }, 400);

  const libro = await obtenerLibroPorId(id);
  if (!libro) return json({ error: 'Libro no encontrado.' }, 404);

  const ubicacion = String(body?.ubicacion ?? '').trim() || null;
  await actualizarLibro(id, { ubicacion });
  return json({ ok: true, ubicacion });
};
