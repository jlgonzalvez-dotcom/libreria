import type { APIRoute } from 'astro';
import { crearLibro, actualizarLibro, generarSlugUnico } from '../../lib/libros';

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
  const categoria = String(datos.get('categoria') ?? '').trim();

  // Validación mínima en servidor (los campos ya son required en el HTML).
  if (!titulo || !autor || !categoria) {
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
    isbn: texto(datos.get('isbn')),
    paginas: numero(datos.get('paginas')),
    estado: String(datos.get('estado') ?? 'pendiente'),
    valoracion: numero(datos.get('valoracion')),
    ubicacion: texto(datos.get('ubicacion')),
    formato: String(datos.get('formato') ?? 'papel'),
    portada: texto(datos.get('portada')),
    sinopsis: texto(datos.get('sinopsis')),
    notas: texto(datos.get('notas')),
    destacado: datos.get('destacado') === 'on',
    en_venta: datos.get('en_venta') === 'on',
    precio: numero(datos.get('precio')),
    estado_conservacion: texto(datos.get('estado_conservacion')),
    resena: texto(datos.get('resena')),
  };

  if (id) {
    const slug = await generarSlugUnico(titulo, id);
    await actualizarLibro(id, { ...campos, slug });
    return redirect('/admin?ok=editado');
  }

  const slug = await generarSlugUnico(titulo);
  await crearLibro({ ...campos, slug });
  return redirect('/admin?ok=creado');
};
