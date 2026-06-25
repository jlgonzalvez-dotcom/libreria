import { supabase } from './supabase';

const BUCKET = 'portadas';

// Extensión de archivo según el tipo MIME admitido.
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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
