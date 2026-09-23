import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { register } from './domain/registration.mjs';
import { createStore } from './storage/json-store.mjs';
import { DomainError, createTask, updateTask, publishTask, addProposal, selectTeam, present } from './domain/tasks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = {
  '/': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/styles.css': ['styles.css', 'text/css'],
};

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new DomainError('Слишком большой запрос.', 413);
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new DomainError('Некорректный JSON.'); }
}

export function makeServer({ dataFile = resolve(root, 'data/tasks.json') } = {}) {
  const store = createStore(dataFile);
  const users = createStore(resolve(dirname(dataFile), 'users.json'));
  return createServer(async (req, res) => {
    function json(status, value) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && url.pathname === '/api/register') {
        return json(201, await register(await body(req), users));
      }
      if (req.method === 'GET' && assets[url.pathname]) {
        const [name, mime] = assets[url.pathname];
        const content = await readFile(resolve(root, 'public', name));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
        res.end(content);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/tasks') {
        let tasks = store.read().map(present);
        if (url.searchParams.get('catalog') === '1') tasks = tasks.filter(t => t.status !== 'draft');
        tasks.sort((a, b) => b.rating.score - a.rating.score || b.createdAt.localeCompare(a.createdAt));
        return json(200, tasks);
      }
      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const input = await body(req);
        const task = createTask(input);
        store.write([...store.read(), task]);
        return json(201, present(task));
      }
      const match = url.pathname.match(/^\/api\/tasks\/([^/]+)(?:\/(publish|proposals|select))?$/);
      if (match && ['PATCH', 'POST'].includes(req.method)) {
        const [, id, action] = match;
        const input = await body(req);
        const tasks = store.read();
        const index = tasks.findIndex(t => t.id === id);
        if (index < 0) throw new DomainError('Задача не найдена.', 404);
        const task = tasks[index];
        if (req.method === 'PATCH' && !action) tasks[index] = updateTask(task, input);
        else if (req.method === 'POST' && action === 'publish') tasks[index] = publishTask(task);
        else if (req.method === 'POST' && action === 'proposals') tasks[index] = addProposal(task, input);
        else if (req.method === 'POST' && action === 'select') tasks[index] = selectTeam(task, input.proposalId);
        else throw new DomainError('Маршрут не найден.', 404);
        store.write(tasks);
        return json(200, present(tasks[index]));
      }
      json(404, { error: 'Маршрут не найден.' });
    } catch (error) {
      if (!(error instanceof DomainError)) console.error(error);
      json(error.status ?? 500, { error: error instanceof DomainError ? error.message : 'Ошибка сервера.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3000);
  makeServer().listen(port, '127.0.0.1', () => console.log(`TaskUp: http://localhost:${port}`));
}
