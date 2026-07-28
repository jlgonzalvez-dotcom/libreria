// Tipografías de la casa, en un solo sitio para que la web pública y el panel
// pidan exactamente lo mismo (y el navegador reutilice la misma descarga).
//
// Fraunces (serif, con itálica) para titulares y el logotipo; Inter para el
// texto. Grosores: los que usa realmente global.css (400, 500, 600 y 700).
// `display=swap` hace que el texto se vea desde el primer momento con la fuente
// de reserva y cambie al llegar la definitiva, en vez de quedarse invisible.
export const URL_FUENTES =
  'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500' +
  '&family=Inter:wght@400;500;600;700' +
  '&display=swap';
