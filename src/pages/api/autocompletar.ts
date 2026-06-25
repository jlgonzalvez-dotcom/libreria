import type { APIRoute } from 'astro';
import { sesionValida, COOKIE_SESION } from '../../lib/auth';
import { buscarDatos } from '../../lib/biblio';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  // Solo accesible con sesión de admin (el formulario lo llama same-origin).
  if (!(await sesionValida(cookies.get(COOKIE_SESION)?.value))) {
    return json({ encontrado: false }, 401);
  }

  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return json({ encontrado: false });

  try {
    return json(await buscarDatos(q));
  } catch {
    return json({ encontrado: false });
  }
};
