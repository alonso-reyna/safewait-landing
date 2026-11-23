/*
  Línea de ruta: un trazo vertical en el margen izquierdo que se dibuja con el scroll.
  Cada sección es una parada (su etiqueta). En el paso del nodo 4 (Ruta) la línea se abre en tres rutas y se vuelve a juntar.
*/
const NS = 'http://www.w3.org/2000/svg';
const BRANCH_COLORS = ['#5fa3d8', '#162660'];

export class Route {
  constructor(svg, { howEl }) {
    this.svg = svg; this.howEl = howEl;
    this.base = svg.querySelector('.route-base');
    this.draw = svg.querySelector('.route-draw');
    this.gBranches = svg.querySelector('.route-branches');
    this.gStops = svg.querySelector('.route-stops');
    this.stops = []; this.branches = [];
    this.layout();
  }

  layout() {
    const docH = document.documentElement.scrollHeight;
    const W = document.documentElement.clientWidth;
    this.svg.setAttribute('width', W); this.svg.setAttribute('height', docH);
    this.svg.style.height = docH + 'px';
    const sy = window.scrollY;
    const mobile = W <= 820;
    const wrap = document.querySelector('.problem .wrap');
    if (!wrap) return;
    const x = this.x = wrap.getBoundingClientRect().left + (mobile ? 19 : 40);

    // paradas: etiquetas de cada sección (las que viven en una escena fija se miden relativas a su contenedor)
    const labels = [...document.querySelectorAll('.stop-label')];
    this.stops = labels.map(l => {
      const sec = l.closest('[data-section]');
      let y;
      const sticky = l.closest('.how-sticky, .prob-sticky');
      if (sticky) {
        y = sec.getBoundingClientRect().top + sy + (l.getBoundingClientRect().top - sticky.getBoundingClientRect().top) + l.offsetHeight / 2;
      } else y = l.getBoundingClientRect().top + sy + l.offsetHeight / 2;
      return { y, id: sec.dataset.section };
    });
    const hero = document.querySelector('.hero');
    this.y0 = hero.getBoundingClientRect().bottom + sy - (mobile ? 40 : 70);
    const foot = document.querySelector('.foot');
    this.y1 = foot.getBoundingClientRect().top + sy + 40;

    const d = `M${x} ${this.y0} L${x} ${this.y1}`;
    this.base.setAttribute('d', d); this.draw.setAttribute('d', d);
    this.len = this.y1 - this.y0;
    this.draw.style.strokeDasharray = `${this.len} ${this.len}`;

    // ramas en el paso 4: el paso ocupa del 60 % al 80 % del recorrido fijo de la sección
    const hr = this.howEl.getBoundingClientRect();
    const travel = hr.height - window.innerHeight;
    const head = window.innerHeight * 0.62;
    const b0 = hr.top + sy + travel * 0.63 + head, b1 = hr.top + sy + travel * 0.79 + head;
    this.gBranches.replaceChildren();
    this.branches = [-1, 1].map((s, i) => {
      const off = s * (mobile ? 7 : 11), k = (b1 - b0) * 0.18;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${x} ${b0} C${x} ${b0 + k} ${x + off} ${b0 + k * 0.6} ${x + off} ${b0 + k * 1.6} L${x + off} ${b1 - k * 1.6} C${x + off} ${b1 - k * 0.6} ${x} ${b1 - k} ${x} ${b1}`);
      p.setAttribute('stroke', BRANCH_COLORS[i]);
      p.setAttribute('class', 'route-branch');
      this.gBranches.appendChild(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len} ${len}`;
      return { el: p, y0: b0, y1: b1, len };
    });

    this.gStops.replaceChildren();
    this.stops.forEach(s => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', s.y); c.setAttribute('r', mobile ? 5 : 6);
      c.setAttribute('class', 'route-stop');
      this.gStops.appendChild(c); s.el = c;
    });
    const end = document.createElementNS(NS, 'circle');
    end.setAttribute('cx', x); end.setAttribute('cy', this.y1); end.setAttribute('r', 3.5);
    end.setAttribute('class', 'route-end'); this.gStops.appendChild(end);
    this.lastHead = null;
    this.update();
  }

  update() {
    if (!this.len) return;
    const atEnd = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 4;
    const head = atEnd ? this.y1 + 1 : window.scrollY + window.innerHeight * 0.62;
    if (head === this.lastHead) return;
    this.lastHead = head;
    const drawn = Math.min(this.len, Math.max(0, head - this.y0));
    this.draw.style.strokeDashoffset = this.len - drawn;
    this.branches.forEach(b => {
      const k = Math.min(1, Math.max(0, (head - b.y0) / (b.y1 - b.y0)));
      b.el.style.strokeDashoffset = b.len * (1 - k);
    });
    let active = -1;
    this.stops.forEach((s, i) => { if (head >= s.y - 1) active = i; });
    this.stops.forEach((s, i) => {
      s.el.classList.toggle('past', i < active);
      s.el.classList.toggle('on', i === active);
    });
  }
}
