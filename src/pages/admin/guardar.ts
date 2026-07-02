import type { APIRoute } from 'astro';
import { crearLibro, actualizarLibro, generarSlugUnico } from '../../lib/libros';
import { esIsbn } from '../../lib/isbn';
import { esPortadaPropia, guardarPortadaDesdeUrl } from '../../lib/storage';

// ── Helpers de parseo del formulario ─────────────────────────────────────────
function lista(valor: FormDataEntryValue | null): string[] {
  return String(valor ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function numero(valor: FormDataEntryValue | null): number | null {
  const s = String(valor ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: FormDataEntryValue | null): string | null {
  const s = String(valor ?? '').trim();
  return s === '' ? null : s;
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const datos = await request.formData();
  const id = texto(datos.get('id'));

  const titulo = String(datos.get('titulo') ?? '').trim();
  const autor = String(datos.get('autor') ?? '').trim();
  // Categoría opcional: si va vacía, se guarda como "Sin categoría".
  const categoria = String(datos.get('categoria') ?? '').trim() || 'Sin categoría';

  // Solo título y autor son obligatorios.
  if (!titulo || !autor) {
    return redirect(id ? `/admin/${id}` : '/admin/nuevo');
  }

  const campos = {
    titulo,
    autor,
    autores_extra: lista(datos.get('autores_extra')),
    categoria,
    subcategorias: lista(datos.get('subcategorias')),
    etiquetas: lista(datos.get('etiquetas')),
    anio: numero(datos.get('anio')),
    idioma: texto(datos.get('idioma')) ?? 'Español',
    editorial: texto(datos.get('editorial')),
    edicion: numero(datos.get('edicion')),
    ejemplares: numero(datos.get('ejemplares')) ?? 1,
    // El cuadro "ISBN o título" solo se guarda como ISBN si lo es de verdad.
    isbn: esIsbn(String(datos.get('isbn') ?? '').trim()),
    paginas: numero(datos.get('paginas')),
    estado: String(datos.get('estado') ?? 'pendiente'),
    valoracion: numero(datos.get('valoracion')),
    ubicacion: texto(datos.get('ubicacion')),
    formato: String(datos.get('formato') ?? 'papel'),
    portada: texto(datos.get('portada')),
    sinopsis: texto(datos.get('sinopsis')),
    // Si se guarda una sinopsis desde el formulario, el borrador de IA que
    // hubiera pendiente deja de tener sentido: se limpia.
    ...(texto(datos.get('sinopsis')) ? { sinopsis_borrador: null } : {}),
    notas: texto(datos.get('notas')),
    destacado: datos.get('destacado') === 'on',
    en_venta: datos.get('en_venta') === 'on',
    precio: numero(datos.get('precio')),
    estado_conservacion: texto(datos.get('estado_conservacion')),
    resena: texto(datos.get('resena')),
  };

  // Portada externa (Google, Open Library, otra web) → copia al almacén
  // propio, que no caduca. Si la copia falla, se queda la URL externa.
  if (campos.portada && /^https?:\/\//.test(campos.portada) && !esPortadaPropia(campos.portada)) {
    const propia = await guardarPortadaDesdeUrl(campos.portada);
    if (propia) campos.portada = propia;
  }

  if (id) {
    const slug = await generarSlugUnico(titulo, id);
    await actualizarLibro(id, { ...campos, slug });
    return redirect('/admin?ok=editado');
  }

  const slug = await generarSlugUnico(titulo);
  await crearLibro({ ...campos, slug });
  return redirect('/admin?ok=creado');
};
