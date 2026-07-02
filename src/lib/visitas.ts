// Registro de visitas de la web pública, para el panel /admin/visitas.
//
// Privacidad (sin banner de cookies):
//  · No se usan cookies ni localStorage.
//  · No se guarda la IP: `visitante` es un hash irreversible de
//    (día + IP + navegador) que cambia cada día — sirve para contar
//    "personas distintas hoy" sin poder identificar ni seguir a nadie.
//  · País/ciudad los aporta Vercel en cabeceras (x-vercel-ip-*), calculados
//    a partir de la red del visitante; en local no existen.
import { supabase } from './supabase';

// Robots y rastreadores más comunes (incl. las vistas previas de WhatsApp etc.).
const RE_BOT = /bot|crawl|spider|slurp|preview|scan|probe|facebookexternalhit|whatsapp|telegram|skype|curl|wget|python|node-fetch|axios|monitor|pingdom|lighthouse|headless|vercel-screenshot/i;

/** Rutas públicas que cuentan como visita (portada y fichas de libro). */
export function esVisitaPublica(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/libros/');
}

async function hashVisitante(ip: string, ua: string, dia: string): Promise<string> {
  const datos = new TextEncoder().encode(`${dia}|${ip}|${ua}`);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** Apunta una visita. Nunca lanza: la estadística jamás debe romper la página. */
export async function registrarVisita(request: Request, pathname: string): Promise<void> {
  try {
    const h = request.headers;
    const ua = h.get('user-agent') ?? '';
    if (!ua || RE_BOT.test(ua)) return;

    const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const dia = new Date().toISOString().slice(0, 10);
    // Vercel manda la ciudad URL-codificada (p. ej. "M%C3%A1laga").
    const ciudadRaw = h.get('x-vercel-ip-city');
    let ciudad: string | null = null;
    try { ciudad = ciudadRaw ? decodeURIComponent(ciudadRaw) : null; } catch { ciudad = ciudadRaw; }

    // Referente: solo el dominio de origen, y solo si es externo.
    let referente: string | null = null;
    const ref = h.get('referer');
    if (ref) {
      try {
        const u = new URL(ref);
        if (!u.hostname.endsWith('lalibreriadejl.vercel.app') && u.hostname !== 'localhost') {
          referente = u.hostname;
        }
      } catch { /* referer raro: se ignora */ }
    }

    await supabase.from('visitas').insert({
      dia,
      ruta: pathname,
      pais: h.get('x-vercel-ip-country'),
      ciudad,
      region: h.get('x-vercel-ip-country-region'),
      referente,
      visitante: await hashVisitante(ip, ua, dia),
    });
  } catch {
    // Silencio a propósito: mejor perder una visita que tirar la página.
  }
}
