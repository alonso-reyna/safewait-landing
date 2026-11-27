// Los componentes reales de cada nodo, flotando sobre su tarjeta en las slides donde cada integrante presenta el suyo
// (sensor, NodeMCU y actuador). Van en un lienzo aparte, encima de la maqueta y no dentro de su escena, por cuatro razones:
// tienen que caer justo sobre las tarjetas HTML, no deben moverse cuando la cámara de la maqueta se acerca (Ruta, Barrotes),
// llevan su propia luz para leerse igual de día que de noche, y así el velo que funde el lado del texto no los tapa.
// Cada pieza gira en su propio encuadre, como en un plato giratorio visto desde arriba, y reacciona a lo que pasa en la maqueta.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { nodemcu } from './nodemcu.js';
import * as COMP from './componentes.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sale = t => 1 - Math.pow(1 - clamp(t), 3);
// encuadre de cada pieza: un cuadro de LADO (en --u) centrado SUBE arriba de su tarjeta, donde su radio mide RADIO
// (el cuadro es más grande que la pieza para que quepan las ondas del buzzer o la cola del sensor de fuerza)
const FOV = 20, LADO = 330, RADIO = 100, SUBE = 118;
const ENTRA = 1.15, CADA = .17, DURA = 1.1;   // la entrada: cuándo empieza la primera, cada cuánto las demás y lo que tarda

// sets: { idDeSlide: { piezas: [sensor, actuador], bruma } } con los nombres de componentes.js. bruma: detrás de las piezas el
// fondo se aclara un poco, para las slides donde la maqueta alcanza a meterse debajo de ellas
export function flotantes(deck, sets) {
  const canvas = document.createElement('canvas'); canvas.className = 'flotan';
  const bruma = document.createElement('div'); bruma.className = 'bruma';
  deck.querySelector('.velo').after(bruma, canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.autoClear = false;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, 1, .1, 100);
  { const p = new THREE.PMREMGenerator(r); scene.environment = p.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55; p.dispose(); }
  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9d3e6, 1.5), sol = new THREE.DirectionalLight(0xffffff, 2.4), borde = new THREE.DirectionalLight(0x9cc4ff, 1.2);
  sol.position.set(-3, 6, 4); borde.position.set(4, 2.5, -5); scene.add(hemi, sol, borde);

  // una pieza lista para flotar: centrada y a escala 1 = su radio, dentro de un grupo que es el que se mueve
  const caja = new THREE.Box3(), esfera = new THREE.Sphere();
  function monta(o) {
    const u = o.userData, g = new THREE.Group();
    caja.setFromObject(o).getBoundingSphere(esfera);
    const c = u.centro ? new THREE.Vector3(...u.centro) : esfera.center, rad = u.radio || esfera.radius;
    o.position.sub(c); g.add(o); g.scale.setScalar(1 / rad); g.visible = false; scene.add(g);
    return { g, k: 1 / rad, alto: (u.alto ?? 48) * Math.PI / 180, giro: u.giro, fx: u.fx || null };
  }
  const grupos = {};
  for (const id in sets) {
    const s = deck.querySelector(`.slide[data-id="${id}"]`);
    const mcu = nodemcu(); mcu.userData = { alto: 50, radio: 3, giro: -.55 };
    grupos[id] = { lis: [...s.querySelectorAll('.cadena li')], bruma: !!sets[id].bruma, piezas: [COMP[sets[id].piezas[0]](), mcu, COMP[sets[id].piezas[1]]()].map(monta) };
  }

  let cur = null, sig = null, pend = false, t0 = 0, tSig = 0, cambia = 0, W = 0, H = 0, u = 1, x0 = 0, y0 = 0, slots = [];
  // dónde va cada pieza: sobre su tarjeta. Se mide con offset*, que no cambia mientras la tarjeta entra con su animación
  function medir() {
    if (!cur) return;
    u = deck.clientWidth / 1920;
    const col = cur.lis[0].closest('.col'), lado = LADO * u;
    slots = cur.lis.map(li => {
      let x = li.offsetWidth / 2, y = -col.offsetHeight / 2 - SUBE * u;   // la columna va centrada con translateY(-50%)
      for (let e = li; e && e !== deck; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
      return { x, y };
    });
    x0 = Math.floor(slots[0].x - lado / 2); y0 = Math.floor(slots[0].y - lado / 2);
    W = Math.ceil(slots[2].x + lado / 2) - x0; H = Math.ceil(lado);
    for (const e of [canvas, bruma]) Object.assign(e.style, { left: x0 + 'px', top: y0 + 'px', width: W + 'px', height: H + 'px' });
    bruma.style.background = cur.bruma ? slots.map(p => `radial-gradient(circle ${(1.5 * RADIO * u).toFixed(1)}px at ${(p.x - x0).toFixed(1)}px ${(p.y - y0).toFixed(1)}px, var(--bg) 35%, transparent 100%)`).join(',') : 'none';
    r.setPixelRatio(Math.min(3, window.devicePixelRatio || 1)); r.setSize(W, H, false);
  }
  addEventListener('resize', medir);
  const ve = si => { for (const e of [canvas, bruma]) e.classList.toggle('on', si); };
  const pon = g => { cur = g; if (cur) medir(); ve(!!cur); };

  return {
    // cambia de slide: las piezas que había se desvanecen (el lienzo entero) y luego entran las nuevas, una por una
    show(id, t, instant) {
      const g = grupos[id] || null;
      tSig = t;
      if (instant || !cur) { pon(g); t0 = t; pend = false; return; }
      sig = g; pend = true; cambia = t + .34; ve(false);
    },
    // un cuadro: t = reloj de la presentación, f = estado de la maqueta, fijo = sin entrada ni vaivén
    draw(t, f, fijo) {
      if (pend && t >= cambia) { pon(sig); t0 = tSig; pend = false; }
      if (!cur || !W) return;
      const tau = t - t0, lado = LADO * u, d = LADO / 2 / RADIO / Math.tan(FOV * Math.PI / 360);
      r.setScissorTest(false); r.clear(); r.setScissorTest(true);
      cur.piezas.forEach((p, i) => {
        const k = fijo ? 1 : sale((tau - ENTRA - i * CADA) / DURA), s = slots[i], g = p.g;
        if (k <= 0) return;
        g.visible = true;
        g.scale.setScalar(p.k * k);
        g.position.y = fijo ? 0 : .05 * Math.sin(t * 1.1 + i * 2) - .5 * (1 - k);
        g.rotation.set(fijo ? 0 : .09 * Math.sin(t * .7 + i), (fijo ? p.giro ?? .6 : t * .3 + i * 2.1) - 1.6 * (1 - k), fijo ? 0 : .07 * Math.cos(t * .5 + i * 1.7));
        if (p.fx && f) p.fx(f, t);
        // la cámara mira el plato desde arriba; cada pieza con la altura que mejor la enseña
        cam.position.set(0, d * Math.sin(p.alto), d * Math.cos(p.alto)); cam.lookAt(0, 0, 0);
        const vx = s.x - x0 - lado / 2, vy = H - (s.y - y0) - lado / 2;
        r.setViewport(vx, vy, lado, lado); r.setScissor(vx, vy, lado, lado);
        r.clearDepth(); r.render(scene, cam);
        g.visible = false;
      });
    },
  };
}
