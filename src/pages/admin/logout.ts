import type { APIRoute } from 'astro';
import { COOKIE_SESION } from '../../lib/auth';

export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(COOKIE_SESION, { path: '/' });
  return redirect('/admin/login');
};
