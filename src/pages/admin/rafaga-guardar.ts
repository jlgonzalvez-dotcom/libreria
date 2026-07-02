import type { APIRoute } from 'astro';
import { crearLibro, actualizarLibro, obtenerLibroPorId, generarSlugUnico } from '../../lib/libros';
import { esIsbn } from '../../lib/isbn';
import { esPortadaPropia, guardarPortadaDesdeUrl } from '../../lib/storage';

// Protegido por el middleware (cuelga de /admin). Guardado en lote del modo
// ráfaga: crea los libros nuevos y suma ejemplares a los repetidos.
//   { nuevos: [{isbn, titulo, autor, autores_extra, editorial, anio, paginas,
//               portada, categoria}], ejemplares: [idLibroExistente, …] }
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function texto(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

function numero(v: unknown): number | null {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const POST: APIRoute = async ({ request }) => {
  const body: any = await request.json().catch(() => null);
  if (!body) return json({ error: 'Petición mal formada.' }, 400);

  const nuevos: any[] = Array.isArray(body.nuevos) ? body.nuevos : [];
  const ejemplares: string[] = Array.isArray(body.ejemplares) ? body.ejemplares.map(String) : [];
  if (nuevos.length + ejemplares.length === 0) return json({ error: 'No hay nada que guardar.' }, 400);

  let creados = 0;
  let sumados = 0;
  const errores: string[] = [];

  for (const n of nuevos) {
    const titulo = texto(n.titulo);
    const autor = texto(n.autor);
    if (!titulo || !autor) {
      errores.push(String(n.titulo || n.isbn || 'sin título'));
      continue;
    }
    try {
      // Portada externa → copia al almacén propio (si falla, queda la externa).
      let portada = texto(n.portada);
      if (portada && /^https?:\/\//.test(portada) && !esPortadaPropia(portada)) {
        portada = (await guardarPortadaDesdeUrl(portada)) ?? portada;
      }
      const slug = await generarSlugUnico(titulo);
      await crearLibro({
        titulo,
        autor,
        autores_extra: Array.isArray(n.autores_extra) ? n.autores_extra.map(String).filter(Boolean) : [],
        categoria: texto(n.categoria) ?? 'Sin categoría',
        subcategorias: [],
        etiquetas: [],
        anio: numero(n.anio),
        idioma: texto(n.idioma) ?? 'Español',
        editorial: texto(n.editorial),
        isbn: esIsbn(String(n.isbn ?? '').trim()),
        paginas: numero(n.paginas),
        estado: 'pendiente',
        formato: 'papel',
        portada,
        slug,
      });
      creados++;
    } catch {
      errores.push(titulo);
    }
  }

  for (const id of ejemplares) {
    try {
      const libro = await obtenerLibroPorId(id);
      if (!libro) throw new Error('no encontrado');
      await actualizarLibro(id, { ejemplares: (libro.ejemplares ?? 1) + 1 });
      sumados++;
    } catch {
      errores.push(`ejemplar de ${id}`);
    }
  }

  return json({ creados, sumados, errores });
};
