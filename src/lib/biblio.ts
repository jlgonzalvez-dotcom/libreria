// Búsqueda de datos bibliográficos en fuentes gratuitas y sin clave:
//  · Por ISBN: Google Books + Open Library + BNE (Biblioteca Nacional de España).
//  · Por título: Google Books + Open Library.
// La BNE cubre prácticamente todo lo publicado en España (incluido libro antiguo
// y agotado) que suele faltar en Google Books y Open Library.
// Lo usan el autocompletado por ISBN/título y el OCR de portadas.
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

// ── Biblioteca Nacional de España (SRU, Dublin Core) ────────────────────────
const BNE_SRU = 'https://catalogo.bne.es/view/sru/34BNE_INST';

function desescaparXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

/** Texto de todas las etiquetas <dc:tag> del XML (se pide maximumRecords=1). */
function extraerDc(xml: string, tag: string): string[] {
  const re = new RegExp(`<dc:${tag}>([\\s\\S]*?)</dc:${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const txt = desescaparXml(m[1]).replace(/\s+/g, ' ').trim();
    if (txt) out.push(txt);
  }
  return out;
}

// Roles de la BNE que NO son el autor principal (traductor, editor, ilustrador…).
const ROL_SECUNDARIO = /\s(trad|il|ed|dir|comp|coord|pr|ant|rev|col|pref|introd)\.?$/i;

/** "Ruiz Zafón, Carlos 1964-2020 aut" → "Carlos Ruiz Zafón". */
function limpiarPersonaBne(s: string): string {
  let t = s
    .replace(/\b\d{4}(-\d{0,4})?\b/g, ' ') // fechas de nacimiento/muerte
    .replace(/\s(aut|trad|il|ed|dir|comp|coord|pr|ant|rev|col|pref|introd)\.?\s*$/i, '') // rol
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,;\s]+$/, '')
    .trim();
  const c = t.indexOf(',');
  if (c > 0) {
    const apellidos = t.slice(0, c).trim();
    const nombre = t.slice(c + 1).trim();
    if (nombre) t = `${nombre} ${apellidos}`;
  }
  return t.trim();
}

/** Quita el descriptor de soporte del título ("[Texto impreso]", etc.). */
function quitarSoporteBne(titulo: string): string {
  return titulo.replace(/\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

const LUGARES_BNE = new Set([
  'madrid', 'barcelona', 'valencia', 'sevilla', 'zaragoza', 'málaga', 'bilbao',
  'pamplona', 'salamanca', 'granada', 'oviedo', 'santander', 'méxico', 'buenos aires',
  's.l.', '[s.l.]',
]);

/** De los varios dc:publisher (lugar + editoriales) elige la editorial. */
function editorialBne(publishers: string[]): string | null {
  const limpios = publishers.map((p) => p.replace(/[.,;:\s]+$/, '').trim()).filter(Boolean);
  const real = limpios.find((p) => !LUGARES_BNE.has(p.toLowerCase()));
  return real ?? limpios[0] ?? null;
}

async function bneIsbn(isbn: string): Promise<DatosLibro | null> {
  const query = encodeURIComponent(`alma.isbn=${isbn}`);
  const url = `${BNE_SRU}?operation=searchRetrieve&version=1.2&query=${query}&recordSchema=dc&maximumRecords=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const xml = await res.text();
  const titulos = extraerDc(xml, 'title');
  if (titulos.length === 0) return null;
  const personas = [...extraerDc(xml, 'creator'), ...extraerDc(xml, 'contributor')];
  const autores = personas
    .filter((p) => !ROL_SECUNDARIO.test(p)) // descartar traductores/editores/…
    .map(limpiarPersonaBne)
    .filter(Boolean);
  return {
    encontrado: true,
    fuente: 'BNE',
    titulo: quitarSoporteBne(titulos[0]),
    autor: autores[0] ?? null,
    autores_extra: autores.slice(1),
    anio: anioDe(extraerDc(xml, 'date').join(' ')),
    editorial: editorialBne(extraerDc(xml, 'publisher')),
    paginas: null,
    portada: null,
    sinopsis: null,
    isbn,
  };
}

/**
 * Portada de Open Library por ISBN. Existe para muchísimos libros aunque Open
 * Library no tenga su ficha de datos (p. ej. cuando solo los encuentra la BNE).
 * Con `default=false` devuelve 404 si no hay portada, así no servimos una en blanco.
 */
async function portadaOpenLibraryIsbn(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  try {
    const res = await fetch(`${url}?default=false`, { method: 'HEAD' });
    return res.ok ? url : null;
  } catch {
    return null;
  }
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
    const [g, o, b] = await Promise.all([
      googleBooks(`isbn:${isbn}`).catch(() => null),
      openLibraryIsbn(isbn).catch(() => null),
      bneIsbn(isbn).catch(() => null),
    ]);
    // Prioridad: Google Books (suele traer portada/sinopsis) → BNE (datos fiables
    // de libro español) → Open Library. fusionar rellena los huecos del primero.
    const r = fusionar(fusionar(g, b), o);
    // Si nadie trajo portada (caso típico de libro solo en la BNE), probamos la
    // de Open Library por ISBN, que existe aunque no haya ficha de datos.
    if (r && !r.portada) {
      const p = await portadaOpenLibraryIsbn(isbn).catch(() => null);
      if (p) r.portada = p;
    }
    return r ?? { encontrado: false };
  }
  // Por título: Google Books primero; si falla o no encuentra, Open Library.
  const r =
    (await googleBooks(`intitle:${q}`).catch(() => null)) ??
    (await openLibrarySearch(q).catch(() => null));
  return r ?? { encontrado: false };
}
