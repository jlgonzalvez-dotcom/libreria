import { defineMiddleware } from 'astro:middleware';
import { COOKIE_SESION, sesionValida } from './lib/auth';
import { esVisitaPublica, registrarVisita } from './lib/visitas';
import { origenPermitido, rutaNormalizada } from './lib/seguridad';

// waitUntil: en Vercel deja terminar el registro de la visita DESPUÉS de
// servir la página (así no la retrasa). Fuera de Vercel (npm run dev) lanza
// una excepción y caemos al plan B: dejar la promesa correr sin esperarla.
import { waitUntil } from '@vercel/functions';

// Protege el panel: cualquier ruta bajo /admin exige sesión válida,
// excepto la propia página de login (donde se inicia sesión).
// Además, apunta las visitas de la web pública (portada y fichas).
export const onRequest = defineMiddleware(async (context, next) => {
  let pathname: string;
  try {
    pathname = rutaNormalizada(context.url.pathname);
  } catch {
    return new Response('Ruta no válida.', { status: 400 });
  }
  const esAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const esLogin = pathname === '/admin/login' || pathname === '/admin/login/';

  if (esAdmin && !['GET', 'HEAD', 'OPTIONS'].includes(context.request.method) &&
      !origenPermitido(context.request, context.site)) {
    return new Response('Origen no autorizado.', { status: 403 });
  }

  if (esAdmin && !esLogin) {
    const token = context.cookies.get(COOKIE_SESION)?.value;
    if (!(await sesionValida(token))) {
      const destino = encodeURIComponent(pathname);
      return context.redirect(`/admin/login?volver=${destino}`);
    }
  }

  const res = await next();

  if (esAdmin || pathname === '/api/autocompletar') {
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  if (context.request.method === 'GET' && res.status === 200 && esVisitaPublica(pathname)) {
    const registro = registrarVisita(context.request, pathname);
    try {
      waitUntil(registro);
    } catch {
      registro.catch(() => {}); // en dev: que corra de fondo sin bloquear
    }
  }

  return res;
});
