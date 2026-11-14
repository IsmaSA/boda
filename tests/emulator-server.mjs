// HTTP wrapper around the Apps Script emulator, used by the browser E2E test.
//   POST /exec        → Code.gs doPost
//   GET  /__rows      → stored rows (test-only inspection; the real backend has no such endpoint)
//   POST /__props     → replace script properties and reset data
import http from 'node:http';
import { createBackend } from './gas-emulator.mjs';

let backend = createBackend();
const port = Number(process.env.PORT || 8788);

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const send = (obj) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(obj));
    };
    if (req.url === '/exec' && req.method === 'POST') return send(backend.post(body));
    if (req.url === '/__rows') return send({ rows: backend.rows(), history: backend.history(), people: backend.people(), headers: backend.headers, peopleHeaders: backend.peopleHeaders });
    if (req.url === '/__props' && req.method === 'POST') { backend = createBackend(JSON.parse(body || '{}')); return send({ ok: true }); }
    res.writeHead(404).end();
  });
}).listen(port, () => console.log('emulator on ' + port));
