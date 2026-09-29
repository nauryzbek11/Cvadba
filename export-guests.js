'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const file = path.join(dir, 'guests.jsonl');
if (!fs.existsSync(file)) { console.log('Ответов гостей пока нет.'); process.exit(0); }
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const cell = value => { let text = String(value); if (/^[=+@\-\t\r\n]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
const table = [['Дата ответа', 'Имя', 'Придёт', 'Количество гостей', 'Имена гостей'], ...rows.map(r => [r.receivedAt, r.name, r.attendance === 'yes' ? 'Да' : 'Нет', r.count, r.companions])];
const output = path.join(dir, 'guests.csv');
fs.writeFileSync(output, '\uFEFF' + table.map(row => row.map(cell).join(';')).join('\r\n'), { mode: 0o600 });
console.log(`Сохранено ответов: ${rows.length}. Файл: ${output}`);
