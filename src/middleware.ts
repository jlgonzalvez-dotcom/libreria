import { defineMiddleware } from 'astro:middleware';
import { COOKIE_SESION, sesionValida } from './lib/auth';

// Protege el panel: cualquier ruta bajo /admin exige sesión válida,
// excepto la propia página de login (donde se inicia sesión).
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const esAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const esLogin = pathname === '/admin/login';

  if (esAdmin && !esLogin) {
    const token = context.cookies.get(COOKIE_SESION)?.value;
    if (!(await sesionValida(token))) {
      const destino = encodeURIComponent(pathname);
      return context.redirect(`/admin/login?volver=${destino}`);
    }
  }

  return next();
});
