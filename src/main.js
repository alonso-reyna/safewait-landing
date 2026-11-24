// Entrada: todas las pantallas cargan la versión de vidrio (movil.js); en pantallas anchas acomoda su propio layout.
// ?escritorio carga la versión anterior de escritorio. La misma regla vive en el script del <head> de index.html.
const q = new URLSearchParams(location.search);
if (q.has('escritorio')) import('./escritorio.js'); else import('./movil.js');
