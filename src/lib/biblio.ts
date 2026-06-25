// Búsqueda de datos bibliográficos en fuentes gratuitas (Open Library + Google
// Books). Lo usan el autocompletado por ISBN/título y el OCR de portadas.
// Nota: NO mandar User-Agent propio — la CDN de Open Library corta la conexión
// con cabeceras de cliente personalizadas desde el servidor (fetch failed).

export interface DatosLibro {
  encontrado: boolean;
  fuente?: string;
  titulo?: string | null;
  autor?: string | null;
  autores_extra?: string[];
  anio?: number | null;
  editorial?: string | null;
  paginas?: number | null;
  portada?: string | null;
  sinopsis?: string | null;
  isbn?: string | null;
}

/** Si la consulta es un ISBN-10/13 (con o sin guiones), devuelve el ISBN limpio. */
export function esIsbn(s: string): string | null {
  const limpio = s.replace(/[\s-]/g, '');
  if (/^\d{9}[\dXx]$/.test(limpio) || /^\d{13}$/.test(limpio)) return limpio;
  return null;
}

function anioDe(fecha?: string): number | null {
  if (!fecha) return null;
  const m = /\d{4}/.exec(fecha);
  return m ? Number(m[0]) : null;
}

async function googleBooks(q: string): Promise<DatosLibro | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&country=ES&maxResults=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const vi = data.items?.[0]?.volumeInfo;
  if (!vi) return null;
  const autores: string[] = vi.authors ?? [];
  const ids: any[] = vi.industryIdentifiers ?? [];
  const isbn = ids.find((x) => x.type === 'ISBN_13')?.identifier
    ?? ids.find((x) => x.type === 'ISBN_10')?.identifier
    ?? null;
  let portada: string | null = vi.imageLinks?.thumbnail ?? vi.imageLinks?.smallThumbnail ?? null;
  if (portada) portada = portada.replace(/^http:/, 'https:');
  return {
    encontrado: true,
    fuente: 'Google Books',
    titulo: [vi.title, vi.subtitle].filter(Boolean).join('. ') || null,
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: anioDe(vi.publishedDate),
    editorial: vi.publisher ?? null,
    paginas: vi.pageCount ?? null,
    portada,
    sinopsis: vi.description ?? null,
    isbn,
  };
}

async function openLibrarySearch(q: string): Promise<DatosLibro | null> {
  const campos = 'title,author_name,first_publish_year,publisher,number_of_pages_median,cover_i,isbn';
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&fields=${campos}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const doc = data.docs?.[0];
  if (!doc) return null;
  const autores: string[] = doc.author_name ?? [];
  return {
    encontrado: true,
    fuente: 'Open Library',
    titulo: doc.title ?? null,
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: doc.first_publish_year ?? null,
    editorial: doc.publisher?.[0] ?? null,
    paginas: doc.number_of_pages_median ?? null,
    portada: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    sinopsis: null,
    isbn: doc.isbn?.[0] ?? null,
  };
}

async function openLibraryIsbn(isbn: string): Promise<DatosLibro | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const libro = data[`ISBN:${isbn}`];
  if (!libro) return null;
  const autores: string[] = (libro.authors ?? []).map((a: any) => a.name);
  return {
    encontrado: true,
    fuente: 'Open Library',
    titulo: libro.title ?? null,
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: anioDe(libro.publish_date),
    editorial: libro.publishers?.[0]?.name ?? null,
    paginas: libro.number_of_pages ?? null,
    portada: libro.cover?.large ?? libro.cover?.medium ?? null,
    sinopsis: typeof libro.notes === 'string' ? libro.notes : null,
    isbn,
  };
}

/** Toma `base` y rellena sus campos vacíos con los de `extra`. */
function fusionar(base: DatosLibro | null, extra: DatosLibro | null): DatosLibro | null {
  if (!base) return extra;
  if (!extra) return base;
  return {
    encontrado: true,
    fuente: [base.fuente, extra.fuente].filter(Boolean).join(' + '),
    titulo: base.titulo || extra.titulo,
    autor: base.autor || extra.autor,
    autores_extra: base.autores_extra?.length ? base.autores_extra : extra.autores_extra,
    anio: base.anio ?? extra.anio,
    editorial: base.editorial || extra.editorial,
    paginas: base.paginas ?? extra.paginas,
    portada: base.portada || extra.portada,
    sinopsis: base.sinopsis || extra.sinopsis,
    isbn: base.isbn || extra.isbn,
  };
}

/** Busca datos de un libro por ISBN o por título. Devuelve `{encontrado:false}` si no hay nada. */
export async function buscarDatos(consulta: string): Promise<DatosLibro> {
  const q = consulta.trim();
  if (!q) return { encontrado: false };
  const isbn = esIsbn(q);
  if (isbn) {
    const [g, o] = await Promise.all([
      googleBooks(`isbn:${isbn}`).catch(() => null),
      openLibraryIsbn(isbn).catch(() => null),
    ]);
    return fusionar(g, o) ?? { encontrado: false };
  }
  // Por título: Google Books primero; si falla o no encuentra, Open Library.
  const r =
    (await googleBooks(`intitle:${q}`).catch(() => null)) ??
    (await openLibrarySearch(q).catch(() => null));
  return r ?? { encontrado: false };
}
