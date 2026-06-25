import { ADMIN_PASSWORD, AUTH_SECRET } from 'astro:env/server';

// Nombre de la cookie de sesión del panel /admin.
export const COOKIE_SESION = 'libreria_sesion';

// Duración de la sesión: 30 días.
const DURACION_MS = 1000 * 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

// ─── Utilidades de cripto (Web Crypto, disponible en el runtime de Vercel) ───
function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(mensaje: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', key, encoder.encode(mensaje));
  return base64url(firma);
}

/** Comparación en tiempo (aprox.) constante para evitar fugas por temporización. */
function comparaSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ─── Contraseña ──────────────────────────────────────────────────────────────
export function passwordCorrecta(intento: string): boolean {
  return comparaSegura(intento, ADMIN_PASSWORD);
}

// ─── Token de sesión firmado ─────────────────────────────────────────────────
/** Crea un token "<expiración>.<firma HMAC>" válido durante 30 días. */
export async function crearTokenSesion(): Promise<string> {
  const payload = String(Date.now() + DURACION_MS);
  const firma = await hmac(payload);
  return `${payload}.${firma}`;
}

/** Comprueba que el token está bien firmado y no ha caducado. */
export async function sesionValida(token?: string): Promise<boolean> {
  if (!token) return false;
  const punto = token.indexOf('.');
  if (punto < 1) return false;
  const payload = token.slice(0, punto);
  const firma = token.slice(punto + 1);
  const esperado = await hmac(payload);
  if (!comparaSegura(firma, esperado)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}
