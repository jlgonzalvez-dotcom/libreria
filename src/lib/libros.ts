import { supabase } from './supabase';
import type { Database } from './database.types';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type Libro = Database['public']['Tables']['libros']['Row'];
export type LibroInput = Database['public']['Tables']['libros']['Insert'];
export type LibroUpdate = Database['public']['Tables']['libros']['Update'];

// ─── Opciones para los desplegables del formulario /admin ────────────────────
// Los enums fijos coinciden con los CHECK de la base de datos.
export const ESTADOS = ['pendiente', 'leyendo', 'leído', 'consulta'] as const;
export const FORMATOS = ['papel', 'digital', 'audiolibro'] as const;
export const ESTADOS_CONSERVACION = ['nuevo', 'como nuevo', 'bueno', 'aceptable'] as const;

// Categorías sugeridas (el campo admite también escribir una nueva, vía datalist).
export const CATEGORIAS_SUGERIDAS = [
  'Narrativa', 'Novela histórica', 'Novela biográfica', 'Ensayo', 'Ciencia', 'Clásicos', 'Medicina',
  'Historia', 'Poesía', 'Teatro', 'Filosofía', 'Arte', 'Infantil-juvenil', 'Cómic',
  'Tecnología', 'Autoayuda', 'Biografía', 'Religión', 'Derecho', 'Economía',
  'Ajedrez',
];

export const IDIOMAS = [
  'Español', 'Inglés', 'Francés', 'Italiano', 'Alemán',
  'Portugués', 'Catalán', 'Gallego', 'Euskera', 'Latín',
];

// ─── Helpers de slug ─────────────────────────────────────────────────────────
export function generarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos (marcas diacríticas)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Devuelve un slug único, añadiendo -2, -3… si ya existe. */
export async function generarSlugUnico(titulo: string, excluirId?: string): Promise<string> {
  const base = generarSlug(titulo) || 'libro';
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('libros')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.id === excluirId) return slug;
    slug = `${base}-${n++}`;
  }
}

// ─── Sugerencias para el formulario (autocompletar + aviso de duplicados) ─────
export interface SugerenciasFormulario {
  categorias: string[];
  autores: string[];
  editoriales: string[];
  /** Versión ligera de cada libro, para detectar duplicados en el cliente. */
  libros: { id: string; titulo: string; autor: string; isbn: string | null }[];
}

/** A partir de la colección, deriva las listas que alimentan el formulario:
 *  categorías, autores (principal + coautores) y editoriales ya usados (únicos,
 *  ordenados), y una versión ligera de cada libro para avisar de repetidos. */
export function sugerenciasDesde(libros: Libro[]): SugerenciasFormulario {
  const ordenar = (xs: Iterable<string>) =>
    [...new Set(xs)].filter((x) => x && x.trim() !== '').sort((a, b) => a.localeCompare(b, 'es'));

  const autores: string[] = [];
  for (const l of libros) {
    if (l.autor) autores.push(l.autor);
    for (const co of l.autores_extra ?? []) autores.push(co);
  }

  return {
    categorias: ordenar(libros.map((l) => l.categoria ?? '')),
    autores: ordenar(autores),
    editoriales: ordenar(libros.map((l) => l.editorial ?? '')),
    libros: libros.map((l) => ({ id: l.id, titulo: l.titulo, autor: l.autor, isbn: l.isbn })),
  };
}

// ─── Lecturas ────────────────────────────────────────────────────────────────
export async function listarLibros(): Promise<Libro[]> {
  const { data, error } = await supabase
    .from('libros')
    .select('*')
    .order('destacado', { ascending: false })
    .order('titulo', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function obtenerLibroPorSlug(slug: string): Promise<Libro | null> {
  const { data, error } = await supabase
    .from('libros')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function obtenerLibroPorId(id: string): Promise<Libro | null> {
  // Si el id no es un UUID (p. ej. una ruta /admin/loquesea), no consultamos.
  if (!RE_UUID.test(id)) return null;
  const { data, error } = await supabase
    .from('libros')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Escrituras ──────────────────────────────────────────────────────────────
export async function crearLibro(input: LibroInput): Promise<Libro> {
  const { data, error } = await supabase
    .from('libros')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarLibro(id: string, cambios: LibroUpdate): Promise<Libro> {
  const { data, error } = await supabase
    .from('libros')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function borrarLibro(id: string): Promise<void> {
  const { error } = await supabase.from('libros').delete().eq('id', id);
  if (error) throw error;
}
