// Ondas del video: anillo de grosor constante con bordes suaves y un velo tenue adentro (tipo sonar).
import * as THREE from 'three';

const easeOut = k => 1 - Math.pow(1 - k, 3);

export function makeWave(parent, { color = 0x162660, size = 9 } = {}) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(color) }, uR: { value: 0 }, uW: { value: .1 }, uA: { value: 0 }, uFill: { value: 0 }, uS: { value: size } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uC; uniform float uR, uW, uA, uFill, uS;
      void main(){
        float d = length(vUv - .5) * 2. * uS;
        float ring = 1. - smoothstep(uW * .3, uW, abs(d - uR));
        float fill = uFill * smoothstep(uR * .25, uR, d) * (1. - step(uR, d));
        float a = uA * max(ring, fill);
        if (a < .003) discard;
        gl_FragColor = vec4(uC, a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.renderOrder = 5;
  parent.add(mesh);
  const u = mat.uniforms;
  return {
    mesh,
    // k: avance 0 a 1. El anillo crece rápido y se frena, se adelgaza y se apaga.
    play(k, { r0 = .6, r1 = 6, w = .1, a = .8, fill = 0 } = {}) {
      mesh.visible = k > 0 && k < 1;
      if (!mesh.visible) return;
      u.uR.value = r0 + (r1 - r0) * easeOut(k); u.uW.value = w * (1 - .45 * k);
      u.uA.value = a * Math.pow(1 - k, 1.7) * Math.min(1, k * 9); u.uFill.value = fill;
    },
    // halo fijo de radio r y opacidad a
    glow(a, r, fill = .6, w = .08) {
      mesh.visible = a > .003;
      if (!mesh.visible) return;
      u.uR.value = r; u.uW.value = w; u.uA.value = a; u.uFill.value = fill;
    },
  };
}
