// ---------- справочники ----------
const LEVELS = { 'Международный': '#5848d4', 'Республиканский': '#1f9d74', 'Областной': '#3189d6', 'Городской': '#e0a53a', 'Колледжный': '#a3aeaa' };
const AREAS = { 'IT и программирование': '#3a7bd5', 'Медиа и дизайн': '#c2557e', 'Энергосбережение': '#e0a53a', 'Наука и техника': '#5848d4', 'Краеведение и патриотизм': '#1f9d74', 'Социальные проекты': '#2aa3b0' };
const PLACES = { 1: 'I место', 2: 'II место', 3: 'III место' };
const ROMAN = ['', 'I', 'II', 'III'];
const HIGH = ['Международный', 'Республиканский'];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const url = p => encodeURI(p); // относительный путь — работает и локально, и на GitHub Pages
const place = r => PLACES[r.result] ? +r.result : 0;
const resLabel = r => PLACES[r.result] || r.result;
const plural = (n, a, b, c) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c}`;
const initials = n => n.split(' ').slice(0, 2).map(w => w[0]).join('');
const hue = n => Object.values(AREAS)[[...n].reduce((h, c) => h + c.charCodeAt(0), 0) % 6];
const count = (arr, f) => arr.filter(f).length;
const uniq = a => [...new Set(a)];
const store = {
  get: k => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
};
const medal = (r, cls = '') => { const p = place(r); return `<span class="medal ${p ? 'm' + p : 'mo'} ${cls}" title="${esc(resLabel(r))}">${p ? ROMAN[p] : '✓'}</span>`; };

const state = {
  items: [], year: 'all', token: store.get('token'),
  tl: { q: '', levels: new Set(), areas: new Set(), res: 'all' },
  st: { q: '', sort: 'total' },
  table: { key: 'year', dir: -1 },
  gal: new Set(),
  cmp: null,
};

Chart.defaults.font.family = 'Manrope, system-ui, sans-serif';
Chart.defaults.color = '#6c7772';
Chart.defaults.plugins.tooltip.backgroundColor = '#18211d';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.legend.labels.useBorderRadius = true;
Chart.defaults.plugins.legend.labels.borderRadius = 3;
const stagger = { delay: c => c.type === 'data' && c.mode === 'default' ? c.dataIndex * 70 + c.datasetIndex * 50 : 0 };
const grid = { color: '#eef1f0' };

// ---------- выборки ----------
const allYears = () => uniq(state.items.map(i => i.year)).sort();
const inYear = () => state.items.filter(i => state.year === 'all' || i.year === state.year);
const byId = id => state.items.find(i => i.id === +id);
function studentsOf(list) {
  const m = new Map();
  for (const i of list) for (const s of i.students) {
    const p = m.get(s) || { n: s, all: 0, m: [0, 0, 0, 0], items: [], areas: new Set(), years: new Set() };
    p.all++; p.m[place(i)]++; p.items.push(i); p.areas.add(i.area); p.years.add(i.year);
    m.set(s, p);
  }
  return [...m.values()];
}

// ---------- графики ----------
const charts = [];
const chart = (el, cfg) => { const c = new Chart(el, cfg); charts.push(c); return c; };

// ---------- анимации ----------
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
function animate() {
  $$('#view .reveal').forEach((el, k) => { el.style.setProperty('--i', el.dataset.i ?? Math.min(k, 8)); io.observe(el); });
  $$('#view [data-count]').forEach(countUp);
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#view [data-w]').forEach(f => f.style.width = f.dataset.w)));
}
function countUp(el) {
  const to = +el.dataset.count, t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / 800);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function sparkline(vals, color) {
  const w = 92, h = 34, max = Math.max(1, ...vals), dx = w / Math.max(1, vals.length - 1);
  const pts = vals.map((v, k) => [k * dx, h - 3 - (v / max) * (h - 6)]);
  const d = pts.map((p, k) => (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path class="area" d="${d} L${w} ${h} L0 ${h} Z" style="fill:${color}"/><path d="${d}" stroke="${color}"/><circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}" style="fill:${color}" stroke="#fff"/></svg>`;
}

// всплывающая подсказка для не-Chart элементов
const tip = $('#tip');
document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (t) { tip.textContent = t.dataset.tip; tip.classList.add('on'); } });
document.addEventListener('mouseout', e => { if (e.target.closest('[data-tip]')) tip.classList.remove('on'); });
document.addEventListener('mousemove', e => { tip.style.left = Math.min(e.clientX + 12, innerWidth - 250) + 'px'; tip.style.top = e.clientY + 14 + 'px'; });

// шапка педагога — всегда за все годы, это портрет, а не срез
const HERO_PHOTO = 'media/Заслуги/Премии_Героя_Беларуси_Митрополита_Филарета/photo_2026-10-28_13-39-48.jpg';
function hero() {
  const all = state.items, years = allYears();
  const own = all.filter(i => i.kind === 'педагог');
  const stat = (n, l) => `<div><b data-count="${n}">0</b><small>${l}</small></div>`;
  return `<section class="card hero reveal">
    <div class="hero-text">
      <small class="eyebrow">Преподаватель · УО «Гродненский государственный колледж техники, технологий и дизайна»</small>
      <h2>Назарчук Татьяна Николаевна</h2>
      <p>Награды педагога и результаты её воспитанников на конкурсах колледжного, городского, областного, республиканского и международного уровня за ${years[0]?.slice(0, 4)}–${years.at(-1)?.slice(5)} годы.</p>
      <div class="ministat">
        ${stat(years.length, 'учебных лет')}
        ${stat(uniq(all.flatMap(i => i.students)).length, 'подготовлено воспитанников')}
        ${stat(own.length, 'личных наград')}
        ${stat(count(all, i => i.level === 'Международный'), 'международных')}
      </div>
      <div class="hero-act"><a class="btn primary" href="#/teacher">О педагоге</a><a class="btn" href="#/timeline">Все достижения</a></div>
    </div>
    <button class="hero-photo" style="--pos:50% 78%" data-open="20" aria-label="Открыть: Премия имени Митрополита Филарета">
      <img src="${esc(url(HERO_PHOTO))}" alt="Т.Н. Назарчук на вручении Премии имени Митрополита Филарета">
      <span>Вручение диплома II степени · Премия имени Героя Беларуси Митрополита Филарета</span>
    </button>
  </section>`;
}

// =====================================================================
// СТРАНИЦЫ
// =====================================================================
const PAGES = {};

// ---------- Обзор ----------
PAGES.overview = {
  title: 'Обзор', sub: 'Результаты педагогической деятельности в цифрах',
  html(list) {
    const years = allYears();
    const prize = list.filter(place);
    const per = f => years.map(y => f(state.items.filter(i => i.year === y)));
    const kpi = (label, n, sub, spark, color) => `<article class="card kpi reveal lift"><span>${label}</span><b data-count="${n}">0</b>${sparkline(spark, color)}<small>${sub}</small></article>`;
    const wins = list.filter(i => place(i) && place(i) <= 2 && HIGH.includes(i.level)).sort((a, b) => HIGH.indexOf(a.level) - HIGH.indexOf(b.level) || place(a) - place(b));
    return `
    ${hero()}
    <section class="kpis">
      ${kpi('Достижений в портфолио', list.length, state.year === 'all' ? `за ${plural(years.length, 'учебный год', 'учебных года', 'учебных лет')}` : `в ${state.year} учебном году`, per(l => l.length), '#1f7a5a')}
      ${kpi('Призовых мест (I–III)', prize.length, `I — ${count(prize, i => place(i) === 1)} · II — ${count(prize, i => place(i) === 2)} · III — ${count(prize, i => place(i) === 3)}`, per(l => count(l, place)), '#d9a12b')}
      ${kpi('Подготовлено призёров', uniq(prize.flatMap(i => i.students)).length, 'воспитанников с I–III местами', per(l => uniq(l.filter(place).flatMap(i => i.students)).length), '#3189d6')}
      ${kpi('Международный и республиканский уровень', count(list, i => HIGH.includes(i.level)), `${count(list, i => i.level === 'Международный')} междунар. · ${count(list, i => i.level === 'Республиканский')} респ.`, per(l => count(l, i => HIGH.includes(i.level))), '#5848d4')}
    </section>
    <section class="grid g-2-1">
      <article class="card reveal"><header><h2>Динамика по учебным годам</h2><small>нажмите на столбец, чтобы выбрать год</small></header><div class="chart tall"><canvas id="cYears"></canvas></div></article>
      <article class="card reveal"><header><h2>Уровень конкурсов</h2></header>
        <div class="donut"><canvas id="cLevel"></canvas><div class="donut-c"><b id="dN">${list.length}</b><small id="dL">всего</small></div></div>
        <ul class="legend">${Object.entries(LEVELS).map(([l, c]) => [l, c, count(list, i => i.level === l)]).filter(e => e[2]).map(([l, c, n]) => `<li data-lvl="${esc(l)}"><i style="background:${c}"></i>${l}<em>${n}</em></li>`).join('')}</ul>
      </article>
    </section>
    <section class="grid g-1-1">
      <article class="card reveal"><header><h2>Накопительный рост портфолио</h2><small>всего с начала работы</small></header><div class="chart"><canvas id="cCum"></canvas></div></article>
      <article class="card reveal"><header><h2>Направления работы</h2><small>${state.year === 'all' ? 'все годы' : state.year + ' в сравнении со средним'}</small></header><div class="chart"><canvas id="cRadar"></canvas></div></article>
    </section>
    <section class="grid g-1-2">
      <article class="card reveal"><header><h2>Результаты</h2></header>${placesBars(list)}</article>
      <article class="card reveal" id="cmp"></article>
    </section>
    <section class="card reveal"><header><h2>Главные победы</h2><small>I–II места международного и республиканского уровня</small></header>
      ${wins.length ? `<div class="wins">${wins.map(i => `<button class="win" data-open="${i.id}"><div class="cover" style="${i.photos[0] ? `background-image:url('${esc(url(i.photos[0]))}')` : `background:${LEVELS[i.level]}22`}">${medal(i)}</div><div><small>${esc(i.year)} · ${esc(i.level)}</small><h4>${esc(i.title)}</h4><small>${esc(i.students.join(', ') || (i.kind === 'педагог' ? 'Личная награда педагога' : ''))}</small></div></button>`).join('')}</div>` : '<p class="empty">Нет таких побед за выбранный год</p>'}
    </section>`;
  },
  mount(list) {
    const years = allYears();
    const yc = chart($('#cYears'), {
      type: 'bar',
      data: { labels: years, datasets: Object.entries(LEVELS).map(([lvl, color]) => ({
        label: lvl, data: years.map(y => count(state.items, i => i.year === y && i.level === lvl)),
        backgroundColor: years.map(y => state.year === 'all' || y === state.year ? color : color + '40'),
        borderRadius: 4, borderSkipped: false, maxBarThickness: 56,
      })) },
      options: {
        maintainAspectRatio: false, animation: stagger,
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid, border: { display: false } } },
        plugins: { legend: { position: 'bottom' }, tooltip: { mode: 'index', filter: t => t.raw > 0, footer: ts => 'Всего: ' + ts.reduce((s, t) => s + t.raw, 0) } },
        onClick: (_, els) => { if (els[0]) setYear(years[els[0].index] === state.year ? 'all' : years[els[0].index]); },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      },
    });

    const lv = Object.entries(LEVELS).map(([l, c]) => [l, c, count(list, i => i.level === l)]).filter(e => e[2]);
    const dN = $('#dN'), dL = $('#dL');
    const focus = k => {
      if (k == null) { dN.textContent = list.length; dN.style.color = ''; dL.textContent = 'всего'; return; }
      dN.textContent = lv[k][2]; dN.style.color = lv[k][1]; dL.textContent = `${lv[k][0]} · ${Math.round(lv[k][2] / list.length * 100)}%`;
    };
    const dc = chart($('#cLevel'), {
      type: 'doughnut',
      data: { labels: lv.map(e => e[0]), datasets: [{ data: lv.map(e => e[2]), backgroundColor: lv.map(e => e[1]), borderWidth: 2, borderColor: '#fff', hoverOffset: 8 }] },
      options: { maintainAspectRatio: false, cutout: '72%', animation: { animateRotate: true, duration: 1000 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        onHover: (_, els) => focus(els[0]?.index) },
    });
    $('#cLevel').addEventListener('mouseleave', () => focus());
    $$('.legend li').forEach((li, k) => {
      li.onmouseenter = () => { dc.setActiveElements([{ datasetIndex: 0, index: k }]); dc.update(); focus(k); };
      li.onmouseleave = () => { dc.setActiveElements([]); dc.update(); focus(); };
    });

    let total = 0, prize = 0, high = 0;
    const cum = years.map(y => { const l = state.items.filter(i => i.year === y); total += l.length; prize += count(l, place); high += count(l, i => HIGH.includes(i.level)); return [total, prize, high]; });
    const ds = (label, k, color, fill) => ({ label, data: cum.map(c => c[k]), borderColor: color, backgroundColor: color + '1f', fill, cubicInterpolationMode: 'monotone', pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#fff', pointBorderWidth: 2 });
    chart($('#cCum'), {
      type: 'line',
      data: { labels: years, datasets: [ds('Всего наград', 0, '#1f7a5a', true), ds('Призовые места', 1, '#d9a12b', false), ds('Междунар. и респ.', 2, '#5848d4', false)] },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        animation: { duration: 1100, easing: 'easeOutQuart', delay: c => c.type === 'data' && c.mode === 'default' ? c.dataIndex * 120 + c.datasetIndex * 200 : 0 },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid, border: { display: false } } },
        plugins: { legend: { position: 'bottom' } } },
    });

    const areas = Object.keys(AREAS);
    const sets = [{ label: state.year === 'all' ? 'Все годы' : state.year, data: areas.map(a => count(list, i => i.area === a)), borderColor: '#1f7a5a', backgroundColor: '#1f7a5a26', pointBackgroundColor: '#1f7a5a' }];
    if (state.year !== 'all') sets.push({ label: 'В среднем за год', data: areas.map(a => +(count(state.items, i => i.area === a) / years.length).toFixed(1)), borderColor: '#a3aeaa', backgroundColor: 'transparent', borderDash: [4, 4], pointRadius: 0 });
    chart($('#cRadar'), {
      type: 'radar', data: { labels: areas.map(a => a.split(' и ')[0].replace('Социальные проекты', 'Соц. проекты')), datasets: sets },
      options: { maintainAspectRatio: false, elements: { line: { borderWidth: 2 } },
        scales: { r: { beginAtZero: true, ticks: { precision: 0, backdropColor: 'transparent', font: { size: 10 } }, grid, angleLines: grid, pointLabels: { font: { size: 12, weight: 600 } } } },
        plugins: { legend: { position: 'bottom', display: sets.length > 1 }, tooltip: { callbacks: { title: t => areas[t[0].dataIndex] } } } },
    });

    renderCompare();
  },
};

function placesBars(list) {
  const rows = [['I место', count(list, i => place(i) === 1), 'var(--gold)'], ['II место', count(list, i => place(i) === 2), 'var(--silver)'],
    ['III место', count(list, i => place(i) === 3), 'var(--bronze)'], ['Другие награды', count(list, i => !place(i)), '#c9d1ce']];
  const max = Math.max(1, ...rows.map(r => r[1]));
  return rows.map(([l, n, c]) => `<div class="bar"><span>${l}</span><div class="track"><div class="fill" style="background:${c}" data-w="${n / max * 100}%"></div></div><b>${n}</b></div>`).join('')
    + `<small>Доля призовых мест: <b>${list.length ? Math.round(count(list, place) / list.length * 100) : 0}%</b></small>`;
}

function renderCompare() {
  const years = allYears();
  if (years.length < 2) return $('#cmp').innerHTML = '<p class="empty">Нужно минимум два учебных года</p>';
  state.cmp ||= [years.at(-3) ?? years[0], years.at(-2)];
  const [a, b] = state.cmp;
  const L = y => state.items.filter(i => i.year === y);
  const metrics = [
    ['Всего наград', l => l.length], ['Призовые места', l => count(l, place)], ['I места', l => count(l, i => place(i) === 1)],
    ['Международный', l => count(l, i => i.level === 'Международный')], ['Республиканский', l => count(l, i => i.level === 'Республиканский')],
    ['Учащихся-призёров', l => uniq(l.filter(place).flatMap(i => i.students)).length], ['Направлений', l => uniq(l.map(i => i.area)).length],
  ].map(([n, f]) => [n, f(L(a)), f(L(b))]);
  const max = Math.max(1, ...metrics.flatMap(m => [m[1], m[2]]));
  const opt = sel => years.map(y => `<option ${y === sel ? 'selected' : ''}>${y}</option>`).join('');
  $('#cmp').innerHTML = `<header><h2>Сравнение учебных годов</h2><div class="cmp-pick"><select id="cmpA" aria-label="Первый год">${opt(a)}</select><span>→</span><select id="cmpB" aria-label="Второй год">${opt(b)}</select></div></header>
    ${metrics.map(([n, va, vb]) => { const d = vb - va; return `<div class="cmp-row"><span>${n}</span><div class="cmp-bars">
      <div class="track" data-tip="${a}: ${va}"><div class="fill a" data-w="${va / max * 100}%"></div></div>
      <div class="track" data-tip="${b}: ${vb}"><div class="fill b" data-w="${vb / max * 100}%"></div></div></div>
      <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${d > 0 ? '+' + d : d < 0 ? '−' + -d : '0'}</span></div>`; }).join('')}
    <div class="cmp-key"><small><i style="background:#b9c4bf"></i>${a}</small><small><i style="background:var(--accent)"></i>${b}</small></div>`;
  $('#cmpA').onchange = e => { state.cmp[0] = e.target.value; renderCompare(); };
  $('#cmpB').onchange = e => { state.cmp[1] = e.target.value; renderCompare(); };
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#cmp [data-w]').forEach(f => f.style.width = f.dataset.w)));
}

// ---------- Таймлайн ----------
PAGES.timeline = {
  title: 'Таймлайн достижений', sub: 'Награды педагога и её воспитанников по учебным годам',
  html() {
    const chips = (obj, set, kind) => Object.entries(obj).map(([k, c]) => `<button class="chip" style="--c:${c}" data-f="${kind}" data-v="${esc(k)}" aria-pressed="${set.has(k)}">${esc(k)}</button>`).join('');
    const r = state.tl.res;
    return `<section class="card reveal"><div class="tool">
        <div class="grow"><input type="search" id="tlQ" placeholder="Поиск: конкурс, учащийся, работа…" value="${esc(state.tl.q)}"></div>
        <div class="chips">${[['all', 'Все'], ['prize', 'Призовые'], ['other', 'Другие']].map(([v, l]) => `<button class="chip" data-f="res" data-v="${v}" aria-pressed="${r === v}">${l}</button>`).join('')}</div>
      </div>
      <div class="tool" style="margin-top:12px"><div class="chips">${chips(LEVELS, state.tl.levels, 'lvl')}</div></div>
      <div class="tool" style="margin-top:8px"><div class="chips">${chips(AREAS, state.tl.areas, 'area')}</div></div>
    </section>
    <section class="card"><p class="count" id="tlCount"></p><div class="tl" id="tl"></div></section>`;
  },
  mount() { renderTimeline(); },
};

function renderTimeline() {
  const f = state.tl, q = f.q.toLowerCase();
  const base = inYear();
  const ok = i => (!q || [i.title, i.nomination, i.work, ...i.students].join(' ').toLowerCase().includes(q))
    && (!f.levels.size || f.levels.has(i.level)) && (!f.areas.size || f.areas.has(i.area))
    && (f.res === 'all' || (f.res === 'prize') === !!place(i));
  const list = base.filter(ok);
  $('#tlCount').textContent = `Показано ${list.length} из ${base.length}`;
  const groups = allYears().reverse().map(y => [y, list.filter(i => i.year === y).sort((a, b) => (place(a) || 9) - (place(b) || 9))]).filter(g => g[1].length);
  $('#tl').innerHTML = groups.length ? groups.map(([y, items]) => `<h3 class="tl-y reveal">${esc(y)} <small>${plural(items.length, 'награда', 'награды', 'наград')}</small></h3>${items.map((i, k) => `
    <button class="tl-i reveal" data-i="${Math.min(k, 6)}" style="--c:${LEVELS[i.level]}" data-open="${i.id}">
      ${medal(i)}
      <div><h4>${esc(i.title)}</h4>
        ${i.nomination ? `<p>Номинация: ${esc(i.nomination)}</p>` : ''}${i.work ? `<p>${esc(i.work)}</p>` : ''}
        <div class="tags"><span class="tag lvl" style="background:${LEVELS[i.level]}">${esc(i.level)}</span><span class="tag"><span class="dot" style="background:${AREAS[i.area]}"></span>${esc(i.area)}</span>
        ${place(i) ? '' : `<span class="tag">${esc(i.result)}</span>`}${i.kind === 'педагог' ? '<span class="tag own-tag">Личная награда</span>' : ''}${i.students.map(s => `<span class="tag">${esc(s)}</span>`).join('')}</div>
      </div>
      <div class="thumbs">${i.photos.slice(0, 2).map(p => `<span style="background-image:url('${esc(url(p))}')"></span>`).join('')}${i.photos.length > 2 ? `<span>+${i.photos.length - 2}</span>` : ''}</div>
    </button>`).join('')}`).join('') : '<p class="empty">Ничего не найдено — попробуйте снять фильтры</p>';
  animate();
  tlProgress();
}
function tlProgress() {
  const tl = $('#tl'); if (!tl) return;
  const r = tl.getBoundingClientRect();
  tl.style.setProperty('--p', Math.max(0, Math.min(1, (innerHeight * .7 - r.top) / r.height)));
}
addEventListener('scroll', tlProgress, { passive: true });

// ---------- Учащиеся ----------
PAGES.students = {
  title: 'Воспитанники-победители', sub: 'Учащиеся и выпускники, подготовленные Т.Н. Назарчук к конкурсам',
  html(list) {
    const people = studentsOf(list);
    const withSt = list.filter(i => i.students.length);
    const team = count(withSt, i => i.students.length > 1);
    return `<section class="grid g-2-1">
      <article class="card reveal"><header><h2>Самые титулованные воспитанники</h2><small>топ-10 по числу наград</small></header><div class="chart"><canvas id="cTop"></canvas></div></article>
      <article class="card reveal"><header><h2>Формат работ</h2></header>
        <div class="donut"><canvas id="cTeam"></canvas><div class="donut-c"><b>${withSt.length ? Math.round(team / withSt.length * 100) : 0}%</b><small>командных работ</small></div></div>
        <div class="ministat" style="margin-top:16px"><div><b data-count="${people.length}">0</b><small>воспитанников</small></div><div><b data-count="${withSt.length}">0</b><small>работ</small></div><div><b>${withSt.length ? (withSt.reduce((s, i) => s + i.students.length, 0) / withSt.length).toFixed(1) : 0}</b><small>в команде в среднем</small></div></div>
      </article>
    </section>
    <section class="card reveal"><div class="tool"><div class="grow"><input type="search" id="stQ" placeholder="Найти воспитанника…" value="${esc(state.st.q)}"></div>
      <label class="count">Сортировка <select id="stSort"><option value="total">по числу наград</option><option value="gold">по I местам</option><option value="name">по алфавиту</option></select></label></div></section>
    <section class="people" id="people"></section>`;
  },
  mount(list) {
    const people = studentsOf(list).sort((a, b) => b.all - a.all || b.m[1] - a.m[1]).slice(0, 10);
    chart($('#cTop'), {
      type: 'bar',
      data: { labels: people.map(p => p.n), datasets: [[1, 'I место', '#d9a12b'], [2, 'II место', '#9aa6b2'], [3, 'III место', '#c07a4a'], [0, 'Другое', '#d5dcd9']].map(([k, l, c]) => ({ label: l, data: people.map(p => p.m[k]), backgroundColor: c, borderRadius: 4, borderSkipped: false, barThickness: 16 })) },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: stagger,
        scales: { x: { stacked: true, ticks: { precision: 0 }, grid, border: { display: false } }, y: { stacked: true, grid: { display: false } } },
        plugins: { legend: { position: 'bottom' }, tooltip: { mode: 'index', filter: t => t.raw > 0 } },
        onClick: (_, els) => { if (els[0]) openStudent(people[els[0].index].n); },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } },
    });
    const withSt = list.filter(i => i.students.length);
    chart($('#cTeam'), {
      type: 'doughnut',
      data: { labels: ['Индивидуальные', 'Командные'], datasets: [{ data: [count(withSt, i => i.students.length === 1), count(withSt, i => i.students.length > 1)], backgroundColor: ['#3189d6', '#1f7a5a'], borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }] },
      options: { maintainAspectRatio: false, cutout: '74%', plugins: { legend: { position: 'bottom' } } },
    });
    $('#stSort').value = state.st.sort;
    renderPeople();
  },
};
function renderPeople() {
  const q = state.st.q.toLowerCase();
  const sorts = { total: (a, b) => b.all - a.all || b.m[1] - a.m[1], gold: (a, b) => b.m[1] - a.m[1] || b.all - a.all, name: (a, b) => a.n.localeCompare(b.n, 'ru') };
  const people = studentsOf(inYear()).filter(p => p.n.toLowerCase().includes(q)).sort(sorts[state.st.sort]);
  $('#people').innerHTML = people.length ? people.map((p, k) => {
    const ys = [...p.years].sort();
    return `<button class="person reveal" data-i="${k % 8}" data-student="${esc(p.n)}">
      <header><span class="ava" style="background:${hue(p.n)}">${esc(initials(p.n))}</span><span><b>${esc(p.n)}</b><small>${ys.length > 1 ? `${ys[0].slice(0, 4)}–${ys.at(-1).slice(5)}` : esc(ys[0])}</small></span></header>
      <div class="meds"><span class="big">${p.all}</span>${[1, 2, 3].filter(m => p.m[m]).map(m => `<span class="medal m${m}" title="${PLACES[m]}">${p.m[m]}</span>`).join('')}${p.m[0] ? `<span class="medal mo" title="Без места">${p.m[0]}</span>` : ''}</div>
      <div class="tags">${[...p.areas].map(a => `<span class="tag"><span class="dot" style="background:${AREAS[a]}"></span>${esc(a)}</span>`).join('')}</div>
    </button>`;
  }).join('') : '<p class="empty">Никого не найдено</p>';
  animate();
}

// ---------- Конкурсы ----------
PAGES.contests = {
  title: 'Направления работы', sub: 'В каких направлениях и на каком уровне работает педагог',
  html(list) {
    const years = allYears(), areas = Object.keys(AREAS);
    const max = Math.max(1, ...areas.flatMap(a => years.map(y => count(state.items, i => i.area === a && i.year === y))));
    let n = 0;
    const cell = (a, y) => {
      const v = count(state.items, i => i.area === a && i.year === y);
      const dim = state.year !== 'all' && y !== state.year;
      const bg = v ? `rgba(31,122,90,${(.12 + .88 * v / max) * (dim ? .35 : 1)})` : '#f3f5f4';
      return `<button class="cell ${v ? '' : 'z'}" style="--i:${n++};background:${bg};color:${v / max > .5 ? '#fff' : 'var(--ink)'}" ${v ? `data-heat="${esc(a)}|${y}" data-tip="${esc(a)}, ${y}: ${plural(v, 'награда', 'награды', 'наград')}"` : 'tabindex="-1"'}>${v || '·'}</button>`;
    };
    const lv = Object.keys(LEVELS).map(l => [l, count(list, i => i.level === l)]);
    const lmax = Math.max(1, ...lv.map(e => e[1]));
    return `<section class="card reveal"><header><h2>Тепловая карта: направления × годы</h2><small>нажмите на ячейку, чтобы открыть эти награды в таймлайне</small></header>
      <div class="table-wrap"><div class="heat" style="grid-template-columns: minmax(150px, 1.4fr) repeat(${years.length}, minmax(64px, 1fr)); min-width:${150 + years.length * 70}px">
        <span></span>${years.map(y => `<span class="hd">${y}</span>`).join('')}
        ${areas.map(a => `<span class="rl"><span class="dot" style="background:${AREAS[a]}"></span>${a}</span>${years.map(y => cell(a, y)).join('')}`).join('')}
      </div></div>
      <div class="heat-scale">меньше ${[.15, .35, .55, .75, 1].map(k => `<i style="background:rgba(31,122,90,${k})"></i>`).join('')} больше</div>
    </section>
    <section class="grid g-1-1">
      <article class="card reveal"><header><h2>Доля направлений</h2></header><div class="chart"><canvas id="cPolar"></canvas></div></article>
      <article class="card reveal"><header><h2>Лестница уровней</h2><small>от колледжа до международной арены</small></header>
        <div class="pyr">${lv.map(([l, v]) => `<div style="background:${LEVELS[l]}" data-w="${30 + 70 * v / lmax}%"><span>${l}</span><span>${v}</span></div>`).join('')}</div>
      </article>
    </section>
    <section class="card reveal"><header><h2>Все конкурсы</h2><small>нажмите на заголовок столбца для сортировки</small></header><div class="table-wrap"><table id="tbl"></table></div></section>`;
  },
  mount(list) {
    const areas = Object.keys(AREAS).filter(a => count(list, i => i.area === a));
    chart($('#cPolar'), {
      type: 'polarArea',
      data: { labels: areas, datasets: [{ data: areas.map(a => count(list, i => i.area === a)), backgroundColor: areas.map(a => AREAS[a] + 'cc'), borderColor: '#fff', borderWidth: 2 }] },
      options: { maintainAspectRatio: false, animation: { animateRotate: true, animateScale: true, duration: 1100 },
        scales: { r: { ticks: { display: false }, grid, angleLines: { display: false } } },
        plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } },
    });
    renderTable();
  },
};
function renderTable() {
  const cols = [['year', 'Год'], ['title', 'Конкурс'], ['level', 'Уровень'], ['area', 'Направление'], ['result', 'Результат'], ['n', 'Участников']];
  const lvOrder = Object.keys(LEVELS);
  const val = (i, k) => k === 'n' ? i.students.length : k === 'level' ? -lvOrder.indexOf(i.level) : k === 'result' ? -(place(i) || 9) : i[k];
  const { key, dir } = state.table;
  const rows = inYear().slice().sort((a, b) => { const x = val(a, key), y = val(b, key); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
  $('#tbl').innerHTML = `<thead><tr>${cols.map(([k, l]) => `<th data-sort="${k}" ${k === key ? `aria-sort="${dir > 0 ? 'ascending' : 'descending'}"` : ''}>${l}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(i => `<tr data-open="${i.id}"><td>${esc(i.year)}</td><td>${esc(i.title)}</td><td><span class="dot" style="background:${LEVELS[i.level]}"></span>${esc(i.level)}</td><td>${esc(i.area)}</td><td>${medal(i)} ${place(i) ? '' : esc(i.result)}</td><td>${i.students.length || '—'}</td></tr>`).join('')}</tbody>`;
}

// ---------- Галерея ----------
PAGES.gallery = {
  title: 'Галерея наград', sub: 'Дипломы, грамоты, благодарности и фото с конкурсов',
  html() {
    return `<section class="card reveal"><div class="tool"><div class="chips">${Object.entries(AREAS).map(([a, c]) => `<button class="chip" style="--c:${c}" data-gal="${esc(a)}" aria-pressed="${state.gal.has(a)}">${esc(a)}</button>`).join('')}</div><span class="count" id="galCount"></span></div></section>
    <section class="masonry" id="gal"></section>`;
  },
  mount() { renderGallery(); },
};
let galList = [];
function renderGallery() {
  galList = inYear().filter(i => !state.gal.size || state.gal.has(i.area)).flatMap(i => i.photos.map(p => ({ p, i })));
  $('#galCount').textContent = plural(galList.length, 'фотография', 'фотографии', 'фотографий');
  $('#gal').innerHTML = galList.length ? galList.map(({ p, i }, k) => `<button class="ph reveal" data-i="${k % 6}" data-gi="${k}"><div class="imgw"><img loading="lazy" src="${esc(url(p))}" alt="${esc(i.title)}"></div><figcaption><b>${esc(i.title)}</b><small>${esc(i.year)} · ${esc(resLabel(i))}</small></figcaption></button>`).join('') : '<p class="empty">Нет фотографий</p>';
  animate();
}

// ---------- Педагог ----------
PAGES.teacher = {
  title: 'О педагоге', sub: 'Личные награды и наставническая работа',
  html(list) {
    const years = allYears();
    const own = list.filter(i => i.kind === 'педагог');
    const st = list.filter(i => i.kind === 'учащиеся');
    const total = Math.max(1, st.length);
    return `<section class="card hero reveal">
      <div class="hero-text">
        <small class="eyebrow">Преподаватель</small>
        <h2>Назарчук Татьяна Николаевна</h2>
        <p>УО «Гродненский государственный колледж техники, технологий и дизайна». Руководитель проектов воспитанников в IT, медиа и дизайне, энергосбережении, краеведении и социальных проектах.</p>
        <div class="ministat">
          <div><b data-count="${years.length}">0</b><small>учебных лет в портфолио</small></div>
          <div><b data-count="${uniq(state.items.flatMap(i => i.students)).length}">0</b><small>подготовлено воспитанников</small></div>
          <div><b data-count="${count(state.items, place)}">0</b><small>призовых мест</small></div>
          <div><b data-count="${count(state.items, i => i.kind === 'педагог')}">0</b><small>личных наград</small></div>
        </div>
      </div>
      <button class="hero-photo" style="--pos:50% 40%" data-open="9" aria-label="Открыть: Марафон успешных практик">
        <img src="${esc(url('media/Заслуги/Марафон успешных практик специалистов в сфере организации работы с молодежью/Screenshot_2.png'))}" alt="Т.Н. Назарчук с воспитанницей и сертификатом «Марафона успешных практик»">
        <span>Сертификат финала «Марафона успешных практик специалистов в сфере организации работы с молодёжью»</span>
      </button>
    </section>
    <section class="card reveal"><header><h2>Личные награды педагога</h2><small>${plural(own.length, 'награда', 'награды', 'наград')}</small></header>
      ${own.length ? `<div class="own">${own.map((i, k) => `<button class="reveal" data-i="${k}" data-open="${i.id}">${i.photos[0] ? `<span class="own-ph" style="background-image:url('${esc(url(i.photos[0]))}')"></span>` : ''}<b>${esc(resLabel(i))}</b><span>${esc(i.title)}</span><small>${esc(i.year)} · ${esc(i.level)}</small></button>`).join('')}</div>` : '<p class="empty">Нет личных наград за выбранный год</p>'}
    </section>
    <section class="grid g-2-1">
      <article class="card reveal"><header><h2>Наставничество по годам</h2><small>подготовлено воспитанников и получено призовых мест</small></header><div class="chart"><canvas id="cMentor"></canvas></div></article>
      <article class="card reveal"><header><h2>Направления наставничества</h2></header>
        <div class="stack">${Object.entries(AREAS).map(([a, c]) => [a, c, count(st, i => i.area === a)]).filter(e => e[2]).map(([a, c, n]) => `<i style="background:${c}" data-w="${n / total * 100}%" data-tip="${esc(a)}: ${n}"></i>`).join('')}</div>
        <ul class="legend">${Object.entries(AREAS).map(([a, c]) => [a, c, count(st, i => i.area === a)]).filter(e => e[2]).map(([a, c, n]) => `<li><i style="background:${c}"></i>${a}<em>${Math.round(n / total * 100)}%</em></li>`).join('')}</ul>
      </article>
    </section>`;
  },
  mount() {
    const years = allYears();
    const L = y => state.items.filter(i => i.year === y);
    chart($('#cMentor'), {
      data: { labels: years, datasets: [
        { type: 'bar', label: 'Воспитанников', data: years.map(y => uniq(L(y).flatMap(i => i.students)).length), backgroundColor: years.map(y => state.year === 'all' || y === state.year ? '#3189d6' : '#3189d640'), borderRadius: 6, maxBarThickness: 36 },
        { type: 'bar', label: 'Призовых мест', data: years.map(y => count(L(y), place)), backgroundColor: years.map(y => state.year === 'all' || y === state.year ? '#d9a12b' : '#d9a12b40'), borderRadius: 6, maxBarThickness: 36 },
      ] },
      options: { maintainAspectRatio: false, animation: stagger, interaction: { mode: 'index', intersect: false },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid, border: { display: false } } },
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { footer: ts => {
          const n = count(L(years[ts[0].dataIndex]), i => i.kind === 'учащиеся' && !i.students.length);
          return n ? `Без указанных участников: ${plural(n, 'награда', 'награды', 'наград')}` : '';
        } } } } },
    });
  },
};

// =====================================================================
// РОУТЕР И РЕНДЕР
// =====================================================================
function page() { const k = location.hash.replace(/^#\/?/, '').split('?')[0]; return PAGES[k] ? k : 'overview'; }
function render(scrollTop = false) {
  const key = page(), p = PAGES[key], years = allYears();
  charts.splice(0).forEach(c => c.destroy());
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.page === key));
  $('#pageTitle').textContent = p.title;
  $('#pageSub').textContent = p.sub;
  document.title = `${p.title} — Педагог сквозь цифру`;
  $('#years').innerHTML = ['all', ...years].map(y => `<button data-year="${esc(y)}" aria-pressed="${y === state.year}">${y === 'all' ? 'Все годы' : esc(y)}</button>`).join('');
  $('#yearList').innerHTML = years.map(y => `<option value="${esc(y)}">`).join('');
  const view = $('#view'), list = inYear();
  view.innerHTML = p.html(list);
  view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
  p.mount(list);
  animate();
  if (scrollTop) scrollTo({ top: 0, behavior: 'instant' });
}
function setYear(y) { state.year = y; render(); }
addEventListener('hashchange', () => render(true));

// ---------- окна ----------
function openDetail(id) {
  const i = byId(id); if (!i) return;
  $('#detailBody').innerHTML = `
    <div class="tags"><span class="tag lvl" style="background:${LEVELS[i.level]}">${esc(i.level)}</span><span class="tag"><span class="dot" style="background:${AREAS[i.area]}"></span>${esc(i.area)}</span><span class="tag">${esc(i.year)}</span></div>
    <h3>${esc(i.title)}</h3>
    <dl class="kv"><dt>Результат</dt><dd>${medal(i)} ${esc(resLabel(i))}</dd>
      ${i.nomination ? `<dt>Номинация</dt><dd>${esc(i.nomination)}</dd>` : ''}${i.work ? `<dt>Работа</dt><dd>${esc(i.work)}</dd>` : ''}
      <dt>Участники</dt><dd>${i.students.length ? `<div class="tags">${i.students.map(s => `<button class="tag" data-student="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : i.kind === 'педагог' ? 'Лично педагог — Т.Н. Назарчук' : 'Не указано'}</dd></dl>
    ${i.photos.length ? `<div class="pgrid">${i.photos.map((p, k) => `<button data-photo="${i.id}" data-k="${k}" style="background-image:url('${esc(url(p))}')" aria-label="Открыть фото ${k + 1}"></button>`).join('')}</div>` : '<small>Фото не загружены</small>'}
    ${state.token ? `<button class="del" data-del="${i.id}">Удалить запись</button>` : ''}`;
  showDialog('#detail');
}
function openStudent(name) {
  const p = studentsOf(state.items).find(s => s.n === name); if (!p) return;
  const mates = uniq(p.items.flatMap(i => i.students)).filter(s => s !== name);
  $('#detailBody').innerHTML = `
    <div style="display:flex;gap:14px;align-items:center"><span class="ava" style="width:56px;height:56px;font-size:18px;background:${hue(name)}">${esc(initials(name))}</span>
      <div><h3>${esc(name)}</h3><small>${plural(p.all, 'награда', 'награды', 'наград')} · ${[...p.years].sort().join(', ')}</small></div></div>
    <div class="ministat">${[1, 2, 3].map(m => `<div><b>${p.m[m]}</b><small>${PLACES[m]}</small></div>`).join('')}<div><b>${p.m[0]}</b><small>другие</small></div></div>
    <div class="mini">${p.items.sort((a, b) => b.year.localeCompare(a.year)).map(i => `<button data-open="${i.id}">${medal(i)}<span><b style="font-size:13px">${esc(i.title)}</b><br><small>${esc(i.year)} · ${esc(i.level)}</small></span></button>`).join('')}</div>
    ${mates.length ? `<div><small>Работал(а) в команде с:</small><div class="tags" style="margin-top:6px">${mates.map(s => `<button class="tag" data-student="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>` : ''}`;
  showDialog('#detail');
}
function showDialog(sel) { const d = $(sel); if (d.open) { d.firstElementChild?.scrollIntoView?.(); d.scrollTop = 0; } else d.showModal(); }

const viewer = { list: [], k: 0 };
function show(k) {
  viewer.k = (k + viewer.list.length) % viewer.list.length;
  const { p, i } = viewer.list[viewer.k];
  $('#viewerImg').src = url(p);
  $('#viewerCap').textContent = `${i.title} · ${i.year}`;
  $('#viewerN').textContent = `${viewer.k + 1} / ${viewer.list.length}`;
}
function openViewer(list, k) { viewer.list = list; show(k); $('#viewer').showModal(); }
$('#prev').onclick = () => show(viewer.k - 1);
$('#next').onclick = () => show(viewer.k + 1);
document.addEventListener('keydown', e => { if ($('#viewer').open) { if (e.key === 'ArrowLeft') show(viewer.k - 1); if (e.key === 'ArrowRight') show(viewer.k + 1); } });
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }));

// ---------- делегирование кликов ----------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-year],[data-open],[data-student],[data-photo],[data-gi],[data-f],[data-gal],[data-heat],[data-sort],[data-del]');
  if (!t) return;
  const d = t.dataset;
  if (d.year) return setYear(d.year);
  if (d.photo) { const i = byId(d.photo); return openViewer(i.photos.map(p => ({ p, i })), +d.k); }
  if (d.open) return openDetail(d.open);
  if (d.student) return openStudent(d.student);
  if (d.gi) return openViewer(galList, +d.gi);
  if (d.f) {
    if (d.f === 'res') state.tl.res = d.v;
    else { const s = d.f === 'lvl' ? state.tl.levels : state.tl.areas; s.has(d.v) ? s.delete(d.v) : s.add(d.v); t.setAttribute('aria-pressed', s.has(d.v)); }
    if (d.f === 'res') $$('[data-f=res]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === d.v));
    return renderTimeline();
  }
  if (d.gal) { state.gal.has(d.gal) ? state.gal.delete(d.gal) : state.gal.add(d.gal); t.setAttribute('aria-pressed', state.gal.has(d.gal)); return renderGallery(); }
  if (d.heat) {
    const [a, y] = d.heat.split('|');
    Object.assign(state.tl, { q: '', res: 'all', levels: new Set(), areas: new Set([a]) });
    state.year = y;
    return location.hash = '#/timeline';
  }
  if (d.sort) { state.table = { key: d.sort, dir: state.table.key === d.sort ? -state.table.dir : -1 }; return renderTable(); }
  if (d.del && confirm('Удалить это достижение?')) {
    const res = await fetch('api/achievements/' + d.del, { method: 'DELETE', headers: { 'X-Token': state.token } });
    if (res.ok) { $('#detail').close(); load(); } else alert((await res.json()).error);
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'tlQ') { state.tl.q = e.target.value.trim(); renderTimeline(); }
  if (e.target.id === 'stQ') { state.st.q = e.target.value.trim(); renderPeople(); }
});
document.addEventListener('change', e => { if (e.target.id === 'stSort') { state.st.sort = e.target.value; renderPeople(); } });

// ---------- добавление ----------
const form = $('#addForm');
$('#areaSelect').innerHTML = Object.keys(AREAS).map(a => `<option>${a}</option>`).join('');
$('#addBtn').onclick = () => { form.token.value = state.token; $('#formErr').textContent = ''; $('#form').showModal(); };

// уменьшаем фото до 1600px, чтобы не гонять мегабайты
const shrink = file => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: img.width * k, height: img.height * k });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    ok(c.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = fail;
  img.src = URL.createObjectURL(file);
});

form.addEventListener('submit', async e => {
  if (e.submitter?.value !== 'save') return;
  e.preventDefault();
  const f = new FormData(form);
  $('#saveBtn').disabled = true;
  try {
    const body = Object.fromEntries(['year', 'kind', 'level', 'area', 'result', 'title', 'nomination', 'work'].map(k => [k, f.get(k)]));
    body.students = f.get('students').split(',').map(s => s.trim()).filter(Boolean);
    body.images = await Promise.all([...form.photos.files].map(shrink));
    const res = await fetch('api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Token': f.get('token') }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error);
    state.token = f.get('token'); store.set('token', state.token);
    form.reset();
    $('#form').close();
    load();
  } catch (err) {
    $('#formErr').textContent = err.message || 'Не удалось сохранить';
  } finally {
    $('#saveBtn').disabled = false;
  }
});

async function load() {
  try {
    const r = await fetch('api/achievements');
    // GitHub Pages — статика без API: читаем JSON напрямую, редактирование скрываем
    if (!r.ok) $('#addBtn').hidden = true;
    state.items = await (r.ok ? r : await fetch('data/achievements.json')).json();
  } catch {
    $('#view').innerHTML = '<p class="empty">Не удалось загрузить данные — запущен ли сервер?</p>';
    return;
  }
  render();
}
load();
