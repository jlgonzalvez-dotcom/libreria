import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { tareaSemanal } from '../../lib/copia';

// Copia de seguridad automática (cron semanal de Vercel, ver vercel.json).
//
// Vercel llama a esta ruta con la cabecera "Authorization: Bearer CRON_SECRET"
// (el valor de esa variable de entorno). Sin la cabecera correcta → 401, así
// nadie de fuera puede disparar la tarea. Sin la variable configurada → 503.
export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET) {
    return Response.json(
      { error: 'Falta la variable CRON_SECRET (en Vercel y en .env).' },
      { status: 503 },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const resultado = await tareaSemanal();
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error desconocido.' },
      { status: 500 },
    );
  }
};
