/** JSON incrustado en HTML: un dato nunca debe poder cerrar el <script>. */
export function jsonParaScript(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** El login solo vuelve a páginas del panel dentro de esta misma web. */
export function destinoAdmin(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.startsWith('/') || /[\\\r\n]/.test(valor)) return '/admin';
  try {
    const base = 'https://libreria.invalid';
    const destino = new URL(valor, base);
    if (destino.origin !== base || !/^\/admin(?:\/[a-zA-Z0-9-]+)*\/?$/.test(destino.pathname)) return '/admin';
    return destino.pathname + destino.search;
  } catch {
    return '/admin';
  }
}

/** Comprobación explícita para formularios y peticiones JSON del panel. */
export function origenPermitido(request: Request, site?: URL): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origen = request.headers.get('origin');
  if (!origen || origen === 'null') return false;
  return origen === new URL(request.url).origin || origen === site?.origin;
}

/** Normaliza las variantes que el enrutador puede resolver como /admin. */
export function rutaNormalizada(pathname: string): string {
  const decodificada = decodeURIComponent(pathname).replace(/\\/g, '/').replace(/\/+/g, '/');
  if (/[\u0000-\u001f\u007f]/.test(decodificada)) throw new Error('Ruta no válida');
  return new URL(decodificada, 'https://libreria.invalid').pathname;
}

/** Solo descargamos imágenes de los proveedores usados por el catálogo. */
export function portadaExternaPermitida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && [
      'books.google.com', 'books.google.es', 'books.googleusercontent.com',
      'covers.openlibrary.org', 'images-na.ssl-images-amazon.com', 'm.media-amazon.com',
    ].includes(url.hostname);
  } catch {
    return false;
  }
}
