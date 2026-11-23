/* Adrien COLLOS · carte interactive des missions (prototype) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const debug = new URLSearchParams(location.search).has('debug');

  /* ---------- Sprites (bandes horizontales, fond transparent) ---------- */
  const SPR = {
    right: { src: 'assets/walk-right.avif', cw: 174, ch: 306, n: 4 },
    up:    { src: 'assets/walk-up.avif',    cw: 121, ch: 306, n: 4 },
    down:  { src: 'assets/walk-down.avif',  cw: 120, ch: 306, n: 6 },
  };

  /* ---------- Plans (coordonnées dans l'image du décor) ---------- */
  const LAYOUTS = {
    desktop: {
      W: 1672, H: 941, avatarPx: 165, pinPx: 54, dotR: 78,
      nodes: { C:[840,480], T:[835,392], TL:[560,390], S1:[440,384], TR:[1110,390], S2:[1250,384], SP:[850,790],
               W:[650,500], SW:[580,610], S3:[550,690], E:[1030,500], SE:[1095,610], S4:[1100,700] },
      edges: [['C','T'],['T','TL'],['TL','S1'],['T','TR'],['TR','S2'],['C','W'],['W','SW'],['SW','S3'],['C','E'],['E','SE'],['SE','S4'],['SP','C']],
      spots: ['S1','S2','S3','S4'],
      pins:  [[430,262],[1270,262],[300,690],[1400,690]],
      roads: [[0,480,1672,480,170],[840,120,840,941,210]],
      blocks:[[200,100,420,250],[1040,130,520,220],[0,490,470,340],[1200,490,472,350]],
    },
    mobile: {
      W: 941, H: 1672, avatarPx: 128, pinPx: 46, dotR: 96,
      nodes: { C:[480,820], T:[480,705], TL:[340,705], S1:[250,702], TR:[630,705], S2:[740,702], SP:[480,1250],
               W:[385,935], SW:[335,975], S3:[290,1010], E:[580,935], SE:[635,975], S4:[690,1010] },
      edges: [['C','T'],['T','TL'],['TL','S1'],['T','TR'],['TR','S2'],['C','W'],['W','SW'],['SW','S3'],['C','E'],['E','SE'],['SE','S4'],['SP','C']],
      spots: ['S1','S2','S3','S4'],
      pins:  [[175,560],[765,560],[195,1000],[745,1000]],
      roads: [[0,820,941,820,170],[480,250,480,1672,220]],
      blocks:[[0,290,300,350],[660,280,281,360],[0,840,200,550],[755,860,186,520]],
    },
  };

  /* ---------- Missions (lues dans le HTML : une seule source) ---------- */
  const missions = $$('.mission').map((el, i) => ({
    el, i, n: +el.dataset.n, short: el.dataset.short, color: el.dataset.color,
    title: $('[data-title]', el).textContent,
  }));

  const body = document.body;
  const stage = $('#stage'), viewport = $('#viewport'), avatar = $('#avatar'), sprite = $('.sprite', avatar);
  const pinsEl = $('#pins'), mapEl = $('#map'), chipsEl = $('#chips'), toast = $('#toast');

  let L = null, layoutName = null, S = 1, cur = 'SP', walkToken = 0, frameIdx = 0, lastDir = 'down';

  const pickLayout = () => matchMedia('(orientation: portrait)').matches ? 'mobile' : 'desktop';

  /* ---------- Mise en place ---------- */
  function setup() {
    const name = pickLayout();
    if (name !== layoutName) {
      layoutName = name; L = LAYOUTS[name];
      stage.style.width = L.W + 'px'; stage.style.height = L.H + 'px';
      if (!L.nodes[cur]) cur = 'SP';
      buildPins(); buildMap(); buildDebug();
    }
    fit();
    placeAvatar(L.nodes[cur], lastDir, 0);
  }

  function fit() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    S = Math.max(vw / L.W, vh / L.H);
    const tx = (vw - L.W * S) / 2, ty = (vh - L.H * S) / 2;
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${S})`;
    pinsEl.style.setProperty('--pd', (L.pinPx / S) + 'px');
    pinsEl.style.setProperty('--pf', (Math.max(14, L.pinPx * .3) / S) + 'px');
  }

  function buildPins() {
    pinsEl.innerHTML = '';
    missions.forEach((m, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pin'; b.dataset.i = i;
      b.style.left = L.pins[i][0] + 'px'; b.style.top = L.pins[i][1] + 'px';
      b.style.setProperty('--c', m.color);
      b.setAttribute('aria-label', `Mission ${m.n} : ${m.title}`);
      b.innerHTML = `<span class="dot">${m.n}</span><span class="lbl">${m.short}</span>`;
      b.addEventListener('click', () => goMission(i));
      pinsEl.appendChild(b);
    });
    if (!chipsEl.children.length) {
      missions.forEach((m, i) => {
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'chip'; c.style.setProperty('--c', m.color);
        c.innerHTML = `<b>${m.n}</b><span>${m.short}</span>`;
        c.setAttribute('aria-label', `Mission ${m.n} : ${m.title}`);
        c.addEventListener('click', () => goMission(i));
        chipsEl.appendChild(c);
      });
    }
  }

  function buildMap() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    svg.setAttribute('role', 'group');
    let h = `<rect width="${L.W}" height="${L.H}" fill="#d9b98a"/>`;
    L.blocks.forEach(b => h += `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="24" fill="#b88e5e"/>`);
    L.roads.forEach(r => h += `<line x1="${r[0]}" y1="${r[1]}" x2="${r[2]}" y2="${r[3]}" stroke="#4a3b3f" stroke-width="${r[4]}"/>`);
    L.roads.forEach(r => h += `<line x1="${r[0]}" y1="${r[1]}" x2="${r[2]}" y2="${r[3]}" stroke="#ffd23f" stroke-width="10" stroke-dasharray="50 40"/>`);
    missions.forEach((m, i) => {
      const [x, y] = L.nodes[L.spots[i]];
      h += `<g class="mdot" role="button" tabindex="0" data-i="${i}" aria-label="Mission ${m.n} : ${m.title}">
        <circle cx="${x}" cy="${y}" r="${L.dotR}" fill="${m.color}" stroke="#1b1013" stroke-width="12"/>
        <text x="${x}" y="${y + L.dotR * .38}" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="${L.dotR * 1.1}" fill="#1b1013">${m.n}</text></g>`;
    });
    h += `<g class="me" id="me"><circle r="${L.dotR * .62}" fill="#fff" stroke="#e8264e" stroke-width="16"/></g>`;
    svg.innerHTML = h;
    mapEl.innerHTML = ''; mapEl.appendChild(svg);
    $$('.mdot', svg).forEach(g => {
      const go = () => goMission(+g.dataset.i);
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    updateMe(L.nodes[cur]);
  }
  function updateMe(p) { const me = $('#me'); if (me) me.setAttribute('transform', `translate(${p[0]},${p[1]})`); }

  function buildDebug() {
    const d = $('#debug'); d.hidden = !debug; if (!debug) return;
    d.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    let h = '';
    L.edges.forEach(([a, b]) => h += `<line x1="${L.nodes[a][0]}" y1="${L.nodes[a][1]}" x2="${L.nodes[b][0]}" y2="${L.nodes[b][1]}" stroke="#0ff" stroke-width="4"/>`);
    Object.entries(L.nodes).forEach(([k, p]) => h += `<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="#f0f"/><text x="${p[0] + 12}" y="${p[1] - 8}" fill="#fff" font-size="22" font-weight="700" stroke="#000" stroke-width="3" paint-order="stroke">${k}</text>`);
    d.innerHTML = h;
  }

  /* ---------- Avatar ---------- */
  function setSprite(dir, f) {
    const set = SPR[dir === 'left' ? 'right' : dir];
    const H = L.avatarPx / S, k = H / set.ch;
    avatar.classList.toggle('flip', dir === 'left');
    sprite.style.width = set.cw * k + 'px'; sprite.style.height = H + 'px';
    sprite.style.backgroundImage = `url(${set.src})`;
    sprite.style.backgroundSize = `${set.cw * set.n * k}px ${H}px`;
    sprite.style.backgroundPosition = `${-(f % set.n) * set.cw * k}px 0`;
    avatar.style.width = Math.max(set.cw * k, 10) + 'px'; avatar.style.height = H + 'px';
    return { w: set.cw * k, h: H };
  }
  function placeAvatar(p, dir, f) {
    const sz = setSprite(dir, f);
    avatar.style.transform = `translate(${p[0] - sz.w / 2}px,${p[1] - sz.h}px)`;
    avatar.style.zIndex = Math.round(p[1]);
    updateMe(p);
  }

  /* ---------- Chemins ---------- */
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function route(from, to) {
    const nodes = L.nodes, adj = {};
    L.edges.forEach(([a, b]) => { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); });
    const d = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(nodes));
    while (todo.size) {
      let u = null; todo.forEach(k => { if (d[k] !== undefined && (u === null || d[k] < d[u])) u = k; });
      if (u === null || u === to) break;
      todo.delete(u);
      (adj[u] || []).forEach(v => { const nd = d[u] + dist(nodes[u], nodes[v]); if (d[v] === undefined || nd < d[v]) { d[v] = nd; prev[v] = u; } });
    }
    const path = []; let k = to;
    while (k !== undefined) { path.unshift(k); k = prev[k]; }
    return path[0] === from ? path : [from, to];
  }

  function walkTo(target) {
    return new Promise(resolve => {
      const token = ++walkToken;
      const path = route(cur, target);
      if (reduced || path.length < 2) { cur = target; placeAvatar(L.nodes[cur], lastDir, 0); return resolve(); }
      const pts = path.map(k => L.nodes[k]);
      const speed = (L.avatarPx * 1.2) / S;       // allure calme : ~1,2 hauteur de personnage par seconde
      const stride = (L.avatarPx / S) * 0.21;     // distance entre deux images (~6 images par seconde)
      let seg = 0, pos = pts[0].slice(), travelled = 0, last = performance.now();
      const step = now => {
        if (token !== walkToken) return resolve();
        let dt = Math.min(0.05, (now - last) / 1000); last = now;
        let move = speed * dt;
        while (move > 0 && seg < pts.length - 1) {
          const a = pos, b = pts[seg + 1], dd = dist(a, b);
          if (dd <= move) { pos = b.slice(); move -= dd; seg++; travelled += dd; }
          else { pos = [a[0] + (b[0] - a[0]) * move / dd, a[1] + (b[1] - a[1]) * move / dd]; travelled += move; move = 0; }
        }
        const nb = pts[Math.min(seg + 1, pts.length - 1)];
        const vx = nb[0] - pos[0], vy = nb[1] - pos[1];
        if (Math.hypot(vx, vy) > 1) lastDir = Math.abs(vx) > Math.abs(vy) * .8 ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        placeAvatar(pos, lastDir, Math.floor(travelled / stride));
        if (seg >= pts.length - 1) { cur = target; lastDir = 'down'; placeAvatar(L.nodes[cur], 'down', 0); return resolve(); }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Interactions ---------- */
  function enterGame(msg) {
    if (body.dataset.mode !== 'game') {
      body.dataset.mode = 'game';
      say(msg || 'Cliquez sur un bâtiment ou choisissez une mission.');
    }
  }
  let toastT;
  function say(t) { toast.textContent = t; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 3200); }

  async function goMission(i) {
    enterGame(' ');
    toast.classList.remove('show');
    $$('.pin').forEach(p => p.classList.toggle('on', +p.dataset.i === i));
    await walkTo(L.spots[i]);
    setTimeout(() => openMission(i), reduced ? 0 : 180);
  }

  const md = $('#mission-dialog');
  function openMission(i) {
    const m = missions[i];
    $('#md-kicker').textContent = i === 0 ? 'Mission principale · 1 sur 4' : `Mission ${m.n} sur 4`;
    $('#md-title').textContent = m.title;
    const bodyEl = $('#md-body'); bodyEl.innerHTML = '';
    [...m.el.children].filter(n => !n.matches('[data-title]')).forEach(n => bodyEl.appendChild(n.cloneNode(true)));
    $('.dlg', md).style.setProperty('--c', m.color);
    $('.dlg', md).scrollTop = 0;
    if (!md.open) md.showModal();
  }
  [md].forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.addEventListener('close', () => $$('.pin').forEach(p => p.classList.remove('on')));
  });

  $('#start').addEventListener('click', () => enterGame());
  addEventListener('keydown', e => {
    if (md.open || e.target.closest('input,textarea')) return;
    const n = +e.key; if (n >= 1 && n <= 4) goMission(n - 1);
  });

  /* barre du haut opaque quand on quitte la scène (lisibilité sur le fond clair) */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => $('.hud').classList.toggle('solid', e.intersectionRatio < 0.35), { threshold: [0, .35, 1] }).observe($('.hero'));
  }

  /* ---------- Démarrage ---------- */
  const mq = matchMedia('(orientation: portrait)');
  let rT; const onResize = () => { cancelAnimationFrame(rT); rT = requestAnimationFrame(setup); };
  addEventListener('resize', onResize); mq.addEventListener('change', onResize);
  // précharge les 3 bandes de marche
  Object.values(SPR).forEach(s => { const i = new Image(); i.src = s.src; });
  setup();
  window.__site = { goMission, enter: enterGame, get cur() { return cur; } };
})();
