import type { APIRoute } from 'astro';
import { obtenerLibroPorId, actualizarLibro } from '../../lib/libros';
import { buscarDatos } from '../../lib/biblio';
import { redactarSinopsis, hayClaveIa, type DatosParaSinopsis } from '../../lib/ia';
import { esSinopsisUtil } from '../../lib/sinopsis';

// Protegido por el middleware (cuelga de /admin). Dos modos:
//  · { id }        → redacta para un libro de la colección y lo guarda como
//                    BORRADOR (sinopsis_borrador). Lo usa la página /admin/sinopsis.
//  · { titulo, … } → redacta con los datos sueltos del formulario y devuelve el
//                    texto SIN guardar nada (el botón "Redactar con IA").
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

export const POST: APIRoute = async ({ request }) => {
  if (!hayClaveIa()) return json({ resultado: 'sin-clave' }, 503);
  const body: any = await request.json().catch(() => null);
  if (!body) return json({ resultado: 'error', detalle: 'Petición mal formada.' }, 400);

  // ── Modo colección: redactar y guardar como borrador ───────────────────────
  if (body.id) {
    const libro = await obtenerLibroPorId(String(body.id));
    if (!libro) return json({ resultado: 'error', detalle: 'Libro no encontrado.' }, 404);

    // Material para la IA: la sinopsis ya guardada (p. ej. en inglés o sucia)
    // o, si no hay, lo que traigan las fuentes bibliográficas por ISBN.
    // OJO: si lo guardado es un resto de catálogo ("Indice.", "Source title:…"),
    // no sirve como base — se descarta y se busca material de verdad.
    let material = esSinopsisUtil(libro.sinopsis) ? texto(libro.sinopsis) : null;
    if (!material && libro.isbn) {
      const datos = await buscarDatos(libro.isbn).catch(() => null);
      material = texto(datos?.sinopsis);
    }

    const r = await redactarSinopsis({
      titulo: libro.titulo,
      autor: libro.autor,
      autores_extra: libro.autores_extra,
      editorial: libro.editorial,
      anio: libro.anio,
      categoria: libro.categoria,
      idioma: libro.idioma,
      material,
    });
    if (!r.ok) return json({ resultado: r.motivo, detalle: r.detalle ?? null });

    await actualizarLibro(libro.id, { sinopsis_borrador: r.sinopsis });
    return json({ resultado: 'ok', sinopsis: r.sinopsis });
  }

  // ── Modo formulario: redactar con los datos tecleados, sin guardar ─────────
  const datos: DatosParaSinopsis = {
    titulo: texto(body.titulo) ?? '',
    autor: texto(body.autor) ?? '',
    autores_extra: String(body.autores_extra ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    editorial: texto(body.editorial),
    anio: Number(body.anio) || null,
    categoria: texto(body.categoria),
    idioma: texto(body.idioma),
    material: texto(body.sinopsis),
  };
  if (!datos.titulo || !datos.autor) {
    return json({ resultado: 'error', detalle: 'Hacen falta al menos el título y el autor.' }, 400);
  }
  if (!datos.material) {
    const isbn = texto(body.isbn);
    if (isbn) {
      const encontrado = await buscarDatos(isbn).catch(() => null);
      datos.material = texto(encontrado?.sinopsis);
    }
  }

  const r = await redactarSinopsis(datos);
  return r.ok
    ? json({ resultado: 'ok', sinopsis: r.sinopsis })
    : json({ resultado: r.motivo, detalle: r.detalle ?? null });
};
