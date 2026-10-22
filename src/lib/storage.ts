import { supabase } from './supabase';
import { SUPABASE_URL } from 'astro:env/server';
import { portadaExternaPermitida } from './seguridad';

const BUCKET = 'portadas';

// Extensión de archivo según el tipo MIME admitido.
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** ¿La URL ya apunta a nuestro propio almacén de portadas? */
export function esPortadaPropia(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === new URL(SUPABASE_URL).origin &&
      parsed.pathname.startsWith(`/storage/v1/object/public/${BUCKET}/`);
  } catch { return false; }
}

/**
 * Descarga una portada externa (Google Books, Open Library…) y la guarda en
 * el bucket propio, para no depender de servidores ajenos que caducan o van
 * lentos. Devuelve la URL propia, o null si algo falla (se seguirá usando la
 * externa: mejor una portada frágil que ninguna).
 */
export async function guardarPortadaDesdeUrl(url: string): Promise<string | null> {
  if (!portadaExternaPermitida(url)) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    let actual = url;
    let res: Response | undefined;
    for (let salto = 0; salto < 4; salto++) {
      if (!portadaExternaPermitida(actual)) return null;
      res = await fetch(actual, { signal: ac.signal, redirect: 'manual' });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const destino = res.headers.get('location');
      await res.body?.cancel();
      if (!destino) return null;
      actual = new URL(destino, actual).href;
      res = undefined;
    }
    if (!res) return null;
    if (!res.ok) return null;
    const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = EXT[tipo];
    if (!ext) return null;
    if (!res.body || Number(res.headers.get('content-length')) > 5 * 1024 * 1024) {
      await res.body?.cancel();
      return null;
    }
    const reader = res.body.getReader();
    const partes: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 5 * 1024 * 1024) { await reader.cancel(); return null; }
      partes.push(value);
    }
    if (!total) return null;
    const datos = new Uint8Array(total);
    let offset = 0;
    for (const parte of partes) { datos.set(parte, offset); offset += parte.byteLength; }
    const nombre = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, datos, {
      contentType: tipo,
      upsert: false,
    });
    if (error) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(nombre).data.publicUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Sube una imagen al bucket de portadas y devuelve su URL pública. */
export async function subirPortada(file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) {
    throw new Error('Formato no admitido. Usa JPG, PNG, WebP o GIF.');
  }
  const nombre = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(nombre, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(nombre).data.publicUrl;
}
