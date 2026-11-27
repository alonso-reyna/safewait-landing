# Marca de la presentación SafeWait

Guía corta para que cada slide del deck (`pitch/`) suene y se vea igual. Úsala como lista de revisión antes de agregar o cambiar una slide.

## Voz

1. Una idea por slide. Título de hasta 6 palabras y, solo si aporta algo, una línea de apoyo de hasta 12.
2. El título dice lo que se ve o lo que pasa: "Escala 1:15", "Cinco nodos", "02 SOS". Nada de frases de adorno.
3. Antetítulo solo cuando cambia cómo se lee la pantalla (el equipo en la portada, quién presenta cada nodo). Nunca repite al título.
4. Se habla como en la landing: "camión", "parada", verbos concretos. Los nombres de componentes van en la parte de maqueta, no en el pitch.
5. Las cifras se leen de un vistazo: "6 de cada 10". El porcentaje exacto, la fuente y el periodo van en la línea de fuente.
6. Solo se afirma lo que el prototipo hace y el reporte respalda. Sin tiempos de llegada ni promesas de auxilio externo.
7. Los títulos que son un nombre no llevan punto final; las frases completas sí. Las ideas se separan con comas, puntos, dos puntos o paréntesis.
8. El dashboard se nombra "Data Studio".

Frases fijas: "Esperar ya no es un riesgo." (lema), "Un paradero inteligente, seguro y funcional." (producto) y "Creamos SafeWait para que esperar un camión sea seguro para todos." (propósito).

## Imagen

- Colores: azul `#267DC0`, marino `#162660`, noche `#0B1433`, cielo `#7FB6FF`. Rojo `#FF6B5E` solo para alertas.
- Tipografía: Inter Tight en títulos (peso 600, interletrado negativo) e Inter en texto.
- Superficies: vidrio oscuro (`.vidrio`) sobre escenas de noche, vidrio claro (`.vidrio-c`) sobre escenas de día y sobre la maqueta de madera.
- Filas de datos con fondo suave y esquinas redondas, nunca con líneas divisorias.
- La maqueta azul es el producto (pitch y nodos); la de madera es la maqueta física (materiales y distribución).
- Cuando cada integrante presenta su nodo, sobre cada tarjeta (Sensor, NodeMCU, Actuador) flota su componente real en 3D, a su propia escala. Giran despacio y hacen lo mismo que la maqueta: la tira enciende, el buzzer suena, el servo abre, la pantalla muestra el color, la tecla se oprime y el motor gira.

## Movimiento

- Nada entra de golpe: cada bloque sube un poco y aparece, con su retraso (`data-a`).
- La portada es solo el logo al centro. La maqueta nunca aparece armada por primera vez: llega separada por capas y se junta (en "la solución").
- De azul a madera las dos escenas comparten cámara y la de madera entra con un barrido suave.
- Las gráficas y las cotas se dibujan; los números cuentan.
- La situación abre a oscuras con una sola frase al centro ("Quiero que se imaginen esta situación.") y la animación empieza con el siguiente avance. En toda esa slide no hay marca ni pie, para que nada distraiga.
- En cada nodo, el sensor suelta ondas en el instante en que detecta, el LED del NodeMCU parpadea y el actuador responde, todo al mismo tiempo que la maqueta. Iluminación anochece una sola vez; los demás nodos se repiten.
- Los datos viajan de abajo hacia arriba, como en el sistema real: la maqueta con sus cinco NodeMCU, la laptop de la API Flask (con sus líneas POST) y, hasta arriba, la nube con la base de datos SQL.
