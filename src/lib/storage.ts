import { supabase } from './supabase';

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
  return url.includes(`/storage/v1/object/public/${BUCKET}/`);
}

/**
 * Descarga una portada externa (Google Books, Open Library…) y la guarda en
 * el bucket propio, para no depender de servidores ajenos que caducan o van
 * lentos. Devuelve la URL propia, o null si algo falla (se seguirá usando la
 * externa: mejor una portada frágil que ninguna).
 */
export async function guardarPortadaDesdeUrl(url: string): Promise<string | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const tipo = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = EXT[tipo];
    if (!ext) return null;
    const datos = await res.arrayBuffer();
    if (datos.byteLength === 0 || datos.byteLength > 5 * 1024 * 1024) return null;
    const nombre = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, datos, {
      contentType: tipo,
      upsert: false,
    });
    if (error) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(nombre).data.publicUrl;
  } catch {
    return null;
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
