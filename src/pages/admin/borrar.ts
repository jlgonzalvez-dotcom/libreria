import type { APIRoute } from 'astro';
import { borrarLibro } from '../../lib/libros';

export const POST: APIRoute = async ({ request, redirect }) => {
  const datos = await request.formData();
  const id = String(datos.get('id') ?? '').trim();
  if (id) {
    await borrarLibro(id);
  }
  return redirect('/admin?ok=borrado');
};
