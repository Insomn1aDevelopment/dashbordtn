// Дашборд «Педагог сквозь цифру» — бэкенд на Node.js без зависимостей.
// Запуск:  node server.js                                 (только просмотр)
//          $env:ADMIN_TOKEN='секрет'; node server.js      (просмотр + добавление/удаление)
// API:     GET    /api/achievements
//          POST   /api/achievements        заголовок X-Token, тело — JSON записи
//          DELETE /api/achievements/<id>   заголовок X-Token
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'docs'); // docs/ — её же раздаёт GitHub Pages
const MEDIA = path.join(PUBLIC, 'media');
const DATA = path.join(PUBLIC, 'data', 'achievements.json');
const UPLOADS = path.join(MEDIA, 'Заслуги', 'uploads');
const TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_BODY = 30 * 1024 * 1024;
const LEVELS = new Set(['Международный', 'Республиканский', 'Областной', 'Городской', 'Колледжный']);
const RESULTS = new Set(['1', '2', '3', 'Сертификат', 'Благодарность', 'Похвальный лист', 'Участие']);
const KINDS = new Set(['учащиеся', 'педагог']);
const AREAS = new Set(['IT и программирование', 'Медиа и дизайн', 'Энергосбережение', 'Наука и техника', 'Краеведение и патриотизм', 'Социальные проекты']);
const IMG = /^data:image\/(png|jpeg|webp);base64,(.+)$/s;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const load = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const save = items => {
  fs.writeFileSync(DATA + '.tmp', JSON.stringify(items, null, 1));
  fs.renameSync(DATA + '.tmp', DATA); // атомарная замена
};
// ponytail: синхронные чтение/запись файла = встроенная блокировка в одном процессе; БД — когда записей станут тысячи

function validate(d) {
  if (!d || typeof d !== 'object') throw new Error('Ожидается JSON-объект');
  const s = (k, n = 400) => String(d[k] ?? '').trim().slice(0, n);
  const rec = {
    year: s('year'), kind: s('kind'), level: s('level'), area: s('area'), result: s('result'),
    title: s('title'), nomination: s('nomination'), work: s('work'),
    students: (Array.isArray(d.students) ? d.students : []).map(x => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 30),
  };
  const m = rec.year.match(/^(\d{4})-(\d{4})$/);
  if (!m || +m[2] !== +m[1] + 1) throw new Error('Учебный год в формате 2025-2026');
  if (!rec.title) throw new Error('Нужно название конкурса');
  for (const [k, allowed] of [['level', LEVELS], ['result', RESULTS], ['kind', KINDS], ['area', AREAS]])
    if (!allowed.has(rec[k])) throw new Error(`Недопустимое значение поля ${k}`);
  const images = (Array.isArray(d.images) ? d.images : []).slice(0, 10);
  if (images.some(i => !IMG.test(String(i)))) throw new Error('Фото: только PNG, JPEG или WebP');
  return { rec, images };
}

const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
};

function authorized(req, res) {
  const got = Buffer.from(String(req.headers['x-token'] || ''));
  const want = Buffer.from(TOKEN);
  const ok = TOKEN && got.length === want.length && crypto.timingSafeEqual(got, want);
  if (!ok) json(res, 403, { error: 'Неверный ключ или сервер запущен без ADMIN_TOKEN' });
  return ok;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Слишком большие файлы'), { code: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return json(res, 400, { error: 'Плохой адрес' }); }
  let file = path.resolve(PUBLIC, '.' + (p === '/' ? '/index.html' : p));
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 404, { error: 'Не найдено' });
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    if (err && err.code !== 'ENOENT') return json(res, 500, { error: 'Ошибка чтения' });
    fs.readFile(file, (e, buf) => {
      if (e) return json(res, 404, { error: 'Не найдено' });
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
}

async function handle(req, res) {
  const urlPath = new URL(req.url, 'http://x').pathname;

  if (urlPath === '/api/achievements' && req.method === 'GET') return json(res, 200, load());

  if (urlPath === '/api/achievements' && req.method === 'POST') {
    if (!authorized(req, res)) return;
    let rec, images;
    try {
      ({ rec, images } = validate(JSON.parse(await readBody(req))));
    } catch (e) {
      return json(res, e.code === 413 ? 413 : 400, { error: e.message });
    }
    const items = load();
    rec.id = items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
    fs.mkdirSync(UPLOADS, { recursive: true });
    rec.photos = images.map((img, n) => {
      const [, ext, data] = img.match(IMG);
      const name = `${rec.id}_${n}.${ext === 'jpeg' ? 'jpg' : ext}`;
      fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(data, 'base64'));
      return `media/Заслуги/uploads/${name}`;
    });
    items.push(rec);
    save(items);
    return json(res, 201, rec);
  }

  const del = urlPath.match(/^\/api\/achievements\/(\d+)$/);
  if (del && req.method === 'DELETE') {
    if (!authorized(req, res)) return;
    const items = load();
    const left = items.filter(i => i.id !== +del[1]);
    save(left);
    return json(res, left.length < items.length ? 200 : 404, { ok: left.length < items.length });
  }

  if (urlPath.startsWith('/api/')) return json(res, 404, { error: 'Нет такого адреса' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Метод не поддерживается' });
  serveStatic(req, res, urlPath);
}

module.exports = { validate, load, LEVELS, RESULTS, KINDS, AREAS };

if (require.main === module) {
  const port = +process.env.PORT || 8000;
  http.createServer((req, res) => handle(req, res).catch(e => { console.error(e); json(res, 500, { error: 'Ошибка сервера' }); }))
    .listen(port, () => console.log(`http://localhost:${port}  (редактирование ${TOKEN ? 'включено' : 'выключено: задайте ADMIN_TOKEN'})`));
}
