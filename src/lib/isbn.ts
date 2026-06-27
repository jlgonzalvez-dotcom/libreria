// Validación de ISBN: formato + dígito de control (checksum). Sin dependencias
// de servidor, para poder usarlo TANTO en el backend (biblio.ts, guardar.ts)
// COMO en el navegador (formulario de admin: avisar de un ISBN mal tecleado).

/** Quita guiones y espacios. */
export function normalizarIsbn(s: string): string {
  return s.replace(/[\s-]/g, '');
}

/** Si la cadena tiene FORMA de ISBN-10/13 (sin validar el dígito de control),
 *  devuelve el ISBN limpio; si no, null. */
export function esIsbn(s: string): string | null {
  const limpio = normalizarIsbn(s);
  if (/^\d{9}[\dXx]$/.test(limpio) || /^\d{13}$/.test(limpio)) return limpio;
  return null;
}

/** ¿El dígito de control de un ISBN ya limpio (10 o 13 dígitos) es correcto? */
export function isbnChecksumOk(isbn: string): boolean {
  if (/^\d{13}$/.test(isbn)) {
    let suma = 0;
    for (let i = 0; i < 12; i++) suma += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (suma % 10)) % 10 === Number(isbn[12]);
  }
  if (/^\d{9}[\dXx]$/.test(isbn)) {
    let suma = 0;
    for (let i = 0; i < 9; i++) suma += Number(isbn[i]) * (10 - i);
    suma += isbn[9].toUpperCase() === 'X' ? 10 : Number(isbn[9]);
    return suma % 11 === 0;
  }
  return false;
}

/** Clasifica una entrada del usuario:
 *   - 'valido':   tiene forma de ISBN y el dígito de control cuadra.
 *   - 'invalido': tiene forma de ISBN (10/13 cifras) pero el dígito NO cuadra
 *                 → casi seguro un error de tecleo/lectura.
 *   - 'no-isbn':  no parece un ISBN (p. ej. es un título). */
export function validarIsbn(s: string): 'valido' | 'invalido' | 'no-isbn' {
  const limpio = esIsbn(s);
  if (!limpio) return 'no-isbn';
  return isbnChecksumOk(limpio) ? 'valido' : 'invalido';
}
