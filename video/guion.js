// Guion del video (segundos). Lo comparten la imagen (video.js) y el sonido (sonido.mjs): cambia aquí y ambos siguen iguales.
export const DUR = 47.6;
export const T = {
  asm: 0.4,                                  // empieza el armado
  roofIn: [2.7, 4.1],                        // el techo baja desde arriba y se posa
  doorIn: [3.0, 4.1],                        // las hojas de la puerta se cierran
  roofOff: [[4.7, 6.0, 17.4, 18.8], [23.7, 25.0, 32.9, 34.2]],   // el techo se levanta para luz/SOS y para ruta
  night: [6.0, 7.5, 10.0, 11.5], lamp: [7.1, 8.7, 10.0, 11.2],
  sos: [12.5, 13.9, 15.3],                   // cada pulso: se oprime el sensor y suena la alarma
  door: [19.4, 20.9, 22.2, 23.6],
  busIn: [24.2, 27.6], busOut: [31.3, 33.9], oled: [28.7, 29.1, 31.9, 32.3],
  keys: 35.1, keyStep: 0.38,                 // se teclea la clave en el keypad
  bars: [37.7, 39.8, 41.7, 43.1],            // con la clave correcta suben los barrotes
  end: [42.5, 43.5, 45.4, 46.0],             // logo y frase
  dis: [45.4, 47.2], roofOut: [45.4, 46.6],  // se desarma y el loop vuelve a empezar
  // resaltado suave de las piezas de cada nodo: [sube, arriba, baja, fuera]
  hl: { sos: [11.2, 12.2, 16.6, 17.6], door: [18.6, 19.5, 22.6, 23.6], bars: [34.6, 35.6, 41.9, 43.0] },
};
export const CODE = ['1', '2', '3', '4', '#', '#'];
// rótulo de cada nodo: [entra, sale]
export const LABELS = [[5.3, 10.3], [11.3, 17.5], [18.5, 23.7], [24.7, 33.3], [34.3, 41.0]];
// viajes de cámara: [inicio, duración] (el sonido les pone un soplo suave)
export const MOVES = [[4.4, 1.5], [10.2, 1.5], [17.4, 1.5], [23.6, 1.5], [27.6, 1.3], [30.4, 1.3], [33.2, 1.6], [37.0, 1.7], [40.9, 1.7]];
