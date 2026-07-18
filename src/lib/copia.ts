import { supabase } from './supabase';
import { listarLibros, type Libro } from './libros';
import { generarCsv } from './exportacion';

// Copia de seguridad automática y limpieza del almacén, para el cron semanal
// de Vercel (/api/copia-seguridad).

const BUCKET_COPIAS = 'copias';
const BUCKET_PORTADAS = 'portadas';
/** Cuántas copias se conservan (semanales → unos 3 meses de historia). */
const COPIAS_A_CONSERVAR = 12;

/** Crea el bucket privado de copias si aún no existe. */
async function asegurarBucketCopias(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET_COPIAS);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET_COPIAS, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

/** Lista todos los archivos de un bucket (paginando de 1000 en 1000). */
async function listarArchivos(bucket: string) {
  const todos: { name: string; created_at: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list('', {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    todos.push(...(data ?? []).map((f) => ({ name: f.name, created_at: f.created_at ?? '' })));
    if (!data || data.length < 1000) return todos;
  }
}

/** Genera el CSV de la colección y lo guarda en el bucket privado `copias`,
 *  conservando solo las últimas COPIAS_A_CONSERVAR. */
export async function hacerCopiaSeguridad(libros: Libro[]): Promise<{ archivo: string; conservadas: number }> {
  await asegurarBucketCopias();

  const hoy = new Date().toISOString().slice(0, 10);
  const archivo = `la-libreria-de-jl-${hoy}.csv`;
  const csv = new TextEncoder().encode(generarCsv(libros));
  const { error } = await supabase.storage.from(BUCKET_COPIAS).upload(archivo, csv, {
    contentType: 'text/csv; charset=utf-8',
    upsert: true, // si el cron repite el mismo día, se sobreescribe
  });
  if (error) throw error;

  // Conservar solo las N más recientes (el nombre lleva la fecha → orden alfabético = cronológico).
  const archivos = (await listarArchivos(BUCKET_COPIAS)).map((f) => f.name).sort();
  const sobrantes = archivos.slice(0, Math.max(0, archivos.length - COPIAS_A_CONSERVAR));
  if (sobrantes.length > 0) {
    await supabase.storage.from(BUCKET_COPIAS).remove(sobrantes);
  }
  return { archivo, conservadas: archivos.length - sobrantes.length };
}

/** Borra del bucket `portadas` los archivos que ningún libro usa ya (quedaron
 *  huérfanos al borrar un libro o cambiarle la portada). Por seguridad no se
 *  tocan los archivos de las últimas 24 h: una portada recién subida puede
 *  pertenecer a un libro que aún se está rellenando en el formulario. */
export async function limpiarPortadasHuerfanas(libros: Libro[]): Promise<{ borradas: number; enUso: number }> {
  const marcador = `/storage/v1/object/public/${BUCKET_PORTADAS}/`;
  const enUso = new Set<string>();
  for (const l of libros) {
    const i = (l.portada ?? '').indexOf(marcador);
    if (i >= 0) enUso.add(decodeURIComponent(l.portada!.slice(i + marcador.length)));
  }

  const hace24h = Date.now() - 24 * 3600 * 1000;
  const huerfanas = (await listarArchivos(BUCKET_PORTADAS))
    .filter((f) => !enUso.has(f.name))
    .filter((f) => !f.created_at || new Date(f.created_at).getTime() < hace24h)
    .map((f) => f.name);

  // En tandas de 100 para no pasarse del límite de la API.
  for (let i = 0; i < huerfanas.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET_PORTADAS).remove(huerfanas.slice(i, i + 100));
    if (error) throw error;
  }
  return { borradas: huerfanas.length, enUso: enUso.size };
}

/** La tarea completa del cron: copia de seguridad + limpieza de huérfanas. */
export async function tareaSemanal() {
  const libros = await listarLibros();
  const copia = await hacerCopiaSeguridad(libros);
  const limpieza = await limpiarPortadasHuerfanas(libros);
  return { libros: libros.length, copia, limpieza };
}
