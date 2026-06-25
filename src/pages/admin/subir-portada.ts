import type { APIRoute } from 'astro';
import { subirPortada } from '../../lib/storage';

// Protegido por el middleware (cuelga de /admin). Recibe una imagen y
// devuelve su URL pública en Supabase Storage.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const datos = await request.formData();
    const archivo = datos.get('imagen');

    if (!(archivo instanceof File) || archivo.size === 0) {
      return json({ error: 'No se recibió ninguna imagen.' }, 400);
    }
    if (!archivo.type.startsWith('image/')) {
      return json({ error: 'El archivo no es una imagen.' }, 400);
    }
    if (archivo.size > MAX_BYTES) {
      return json({ error: 'La imagen supera el máximo de 5 MB.' }, 400);
    }

    const url = await subirPortada(archivo);
    return json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al subir la imagen.';
    return json({ error: msg }, 500);
  }
};
