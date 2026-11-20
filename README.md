# SafeWait, landing de la expo

Landing de SafeWait, un paradero de transporte público seguro (maqueta a escala 1:15 con cinco nodos NodeMCU).
Proyecto de Implementación de IoT, grupo 4, Tec de Monterrey. Expo: martes 1 de diciembre de 2026.

Stack: Vite + JavaScript, Three.js, GSAP + ScrollTrigger y Lenis. El modelo es el CAD del equipo (`public/models/safewait.glb`).

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:5173.

## Parámetros de URL

| Parámetro | Qué hace |
|---|---|
| `?stand` | Modo stand: tras 90 s sin interacción vuelve al inicio y repite el armado. Úsalo en la laptop del stand. `?stand=30` cambia los segundos. |
| `?quieto` | Desactiva las animaciones (igual que "reducir movimiento" del sistema). |

## Ajustes pendientes (`src/content.js`)

- `lookerUrl`: link público del dashboard de Looker Studio. Mientras esté vacío, el botón "Ver dashboard" no aparece.
- `siteUrl`: URL pública del sitio. Si está vacía, el QR usa la URL con la que se abrió la página (en Railway sale sola; en `localhost` muestra un recuadro pendiente).

## Despliegue en Railway

El repo ya trae `railway.json`: Railway construye con `npm run build` y sirve `dist/` con `npm start` (`serve`, escucha en `$PORT`).

```bash
npm run build
PORT=3000 npm start
```

## Estructura

- `index.html`: secciones y textos fijos.
- `src/content.js`: nodos, equipo y configuración.
- `src/scene.js`: escena 3D (un solo renderer que dibuja en el hero, en Cómo funciona y en Explóralo tú), materiales, armado, camión.
- `src/main.js`: scroll guiado, visor, QR, modo stand.
- `src/route.js`: línea de ruta que se dibuja con el scroll.
- `src/style.css`: estilos.
