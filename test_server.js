const assert = require('node:assert');
const { validate, load, LEVELS, RESULTS, KINDS, AREAS } = require('./server.js');

const good = { year: '2025-2026', kind: 'учащиеся', level: 'Областной', area: 'Медиа и дизайн', result: '1', title: 'Конкурс', students: ['  Иванов Иван ', ''], images: [] };
const { rec, images } = validate(good);
assert.deepStrictEqual(rec.students, ['Иванов Иван']);
assert.deepStrictEqual(images, []);

for (const bad of [{ ...good, year: '2025-2027' }, { ...good, title: ' ' }, { ...good, level: 'Мировой' }, { ...good, area: 'Спорт' },
  { ...good, images: ['data:text/html;base64,AAAA'] }, null])
  assert.throws(() => validate(bad), Error, JSON.stringify(bad));

// все записи в базе должны проходить ту же валидацию
for (const r of load()) {
  assert.ok(LEVELS.has(r.level) && RESULTS.has(r.result) && KINDS.has(r.kind) && AREAS.has(r.area), `запись ${r.id}`);
  validate(r);
}
console.log('ok');
