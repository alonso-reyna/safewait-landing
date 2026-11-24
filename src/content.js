// Textos y datos de la landing. Para activar el botón del dashboard, pon aquí el link público.
export const CONFIG = {
  // URL pública del sitio (Railway). Si se deja vacía, el QR usa la URL con la que se abrió la página.
  siteUrl: 'https://safewait.coretium.ai/',
  // Link público del dashboard de Looker Studio. Vacío = el botón "Ver dashboard" queda oculto.
  lookerUrl: '',
  // Segundos sin interacción antes de que el modo stand (?stand) vuelva al inicio.
  standIdleSeconds: 90,
};

export const NODES = [
  {
    n: 1, key: 'light', name: 'Iluminación', short: 'Luz',
    sensor: 'Fotorresistencia', actuator: 'Tira LED WS2812B', owner: 'Alonso Reyna',
    title: 'La luz se enciende sola.',
    text: 'Una fotorresistencia en el módulo de afuera mide la luz ambiente. Cuando oscurece, la tira LED dentro de la caseta se enciende poco a poco.',
  },
  {
    n: 2, key: 'sos', name: 'SOS', short: 'SOS',
    sensor: 'Sensor de fuerza FSR', actuator: 'Buzzer', owner: 'Valeria Martínez',
    title: 'Pedir ayuda con una mano.',
    text: 'Un sensor de fuerza en el muro del fondo detecta cuando alguien lo presiona. El buzzer, en el módulo de afuera, suena como alerta de auxilio.',
  },
  {
    n: 3, key: 'door', name: 'Acceso', short: 'Puerta',
    sensor: 'Lector NFC', actuator: 'Servomotor', owner: 'Michelle Lagos',
    title: 'La puerta abre con tarjeta.',
    text: 'El lector NFC valida la tarjeta y un servomotor abre la puerta con un mecanismo de piñón y cremallera.',
  },
  {
    n: 4, key: 'route', name: 'Ruta', short: 'Ruta',
    sensor: 'Sensor de color TCS34725', actuator: 'Pantalla OLED', owner: 'Josué Patricio Mares',
    title: 'Sabes qué camión llegó.',
    text: 'Un sensor de color asoma por la calle, frente al paradero. Lee la franja de color bajo el camión y la pantalla OLED, en el muro izquierdo de la caseta, muestra la ruta.',
  },
  {
    n: 5, key: 'bars', name: 'Barrotes', short: 'Barrotes',
    sensor: 'Keypad', actuator: 'Motor a pasos', owner: 'Ximena García',
    title: 'Barrotes frente a las ventanas.',
    text: 'Con el código correcto en el keypad, un motor a pasos sube ocho barrotes que cubren las ventanas. El mecanismo va escondido bajo la banqueta y la cremallera sale junto a la ventana izquierda.',
  },
];

export const TEAM = [
  { name: 'Alonso Reyna', area: 'Iluminación', role: 'Nodo 1, Iluminación', extra: 'Product Owner' },
  { name: 'Valeria Martínez', area: 'SOS', role: 'Nodo 2, SOS', extra: 'Scrum Master' },
  { name: 'Michelle Lagos', area: 'Acceso', role: 'Nodo 3, Acceso', extra: 'Hardware' },
  { name: 'Josué Patricio Mares', area: 'Ruta', role: 'Nodo 4, Ruta', extra: 'Software' },
  { name: 'Ximena García', area: 'Barrotes', role: 'Nodo 5, Barrotes', extra: 'Integración' },
];
export const TEACHERS = 'Claudia Solís y Xochitl Zapata';
