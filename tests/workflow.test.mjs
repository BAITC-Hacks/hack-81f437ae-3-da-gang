import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { makeServer } from '../src/server.mjs';
import { createTask, rate } from '../src/domain/tasks.mjs';

const complete = {
  title: 'Автоматизация заявок небольшого кафе',
  problem: 'Менеджер кафе вручную переносит заявки из разных чатов и регулярно теряет часть заказов.',
  outcome: 'Веб-приложение для сбора заявок с единой таблицей и статусами обработки.',
  successCriteria: 'Все тестовые заявки видны в таблице; статус можно изменить за два клика.',
  resources: 'Предоставим обезличенные примеры заявок и консультацию менеджера.',
  deadline: 'Две недели после старта',
};

test('рейтинг требует основные поля, даже если дополнительные заполнены', () => {
  const task = createTask({ ...complete, outcome: '' });
  assert.equal(rate(task).score, 75);
  assert.equal(rate(task).canPublish, false);
  assert.equal(rate(createTask(complete)).score, 100);
});

test('HTTP: черновик → публикация → отклик → выбор, сохранение и ограничения', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'taskup-test-'));
  const dataFile = join(dir, 'tasks.json');
  let server;
  async function start() {
    server = makeServer({ dataFile });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  try {
    let base = await start();
    async function request(path = '', method = 'GET', data) {
      const response = await fetch(`${base}/api/tasks${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
      return { status: response.status, body: await response.json() };
    }
    assert.equal((await fetch(base)).status, 200);
    const created = await request('', 'POST', { title: 'Новая задача' });
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal((await request('?catalog=1')).body.length, 0);
    assert.equal((await request(`/${id}/publish`, 'POST', {})).status, 400);
    assert.equal((await request(`/${id}/proposals`, 'POST', { teamName: 'Команда', message: 'Предлагаем сделать рабочий прототип.' })).status, 409);
    const updated = await request(`/${id}`, 'PATCH', complete);
    assert.equal(updated.body.rating.score, 100);
    assert.equal((await request(`/${id}/publish`, 'POST', {})).body.status, 'published');
    assert.equal((await request('?catalog=1')).body.length, 1);
    assert.equal((await request(`/${id}`, 'PATCH', { title: 'Нельзя менять' })).status, 409);
    assert.equal((await request(`/${id}/select`, 'POST', { proposalId: 'missing' })).status, 404);
    const proposal = { teamName: '3 da gang', message: 'Сделаем прототип и проверим на предоставленных данных.' };
    const applied = await request(`/${id}/proposals`, 'POST', proposal);
    assert.equal(applied.status, 200);
    assert.equal((await request(`/${id}/proposals`, 'POST', proposal)).status, 409);
    const proposalId = applied.body.proposals[0].id;
    const selected = await request(`/${id}/select`, 'POST', { proposalId });
    assert.equal(selected.body.status, 'matched');
    assert.equal(selected.body.selectedProposalId, proposalId);
    assert.equal((await request(`/${id}/proposals`, 'POST', { ...proposal, teamName: 'Другая' })).status, 409);
    assert.equal((await request(`/${id}/select`, 'POST', { proposalId })).status, 409);
    await stop();
    base = await start();
    assert.equal((await request()).body[0].selectedProposalId, proposalId);
    assert.equal((await request('', 'POST', { title: 123 })).status, 400);
  } finally {
    if (server?.listening) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
