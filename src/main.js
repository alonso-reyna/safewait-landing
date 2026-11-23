// Entrada: en pantallas angostas carga la versión de celular (movil.js); en las demás, la de escritorio.
// ?movil y ?escritorio fuerzan una u otra. La misma regla vive en el script del <head> de index.html.
const q = new URLSearchParams(location.search);
const mq = window.matchMedia('(max-width: 820px)');
const movil = q.has('movil') || (mq.matches && !q.has('escritorio'));
if (movil) import('./movil.js'); else import('./escritorio.js');
// al cruzar el corte (girar una tableta, cambiar el tamaño de la ventana) se recarga con la otra versión
mq.addEventListener('change', () => location.reload());
