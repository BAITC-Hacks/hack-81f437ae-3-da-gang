import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/domain/registration.mjs';

const input = { name: 'Назар', role: 'student', organization: '3 da gang', email: 'Nazar@example.com', password: 'example-password', passwordConfirm: 'example-password' };
function memoryStore() {
  let users = [];
  return { read: () => users, write: value => { users = value; } };
}

test('регистрация сохраняет профиль и хеш, но не возвращает секреты', async () => {
  const store = memoryStore();
  const user = await register(input, store);
  assert.equal(user.email, 'nazar@example.com');
  assert.equal(user.role, 'student');
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.salt, undefined);
  assert.equal(store.read()[0].password, undefined);
  assert.match(store.read()[0].passwordHash, /^[a-f0-9]{128}$/);
  assert.equal(JSON.stringify(store.read()).includes(input.password), false);
  await assert.rejects(register({ ...input, email: ' NAZAR@example.com ' }, store), error => error.status === 409);
  await register({ ...input, role: 'business', email: 'business@example.com' }, store);
  assert.equal(store.read().length, 2);
  assert.notEqual(store.read()[0].passwordHash, store.read()[1].passwordHash);
});

test('проверки полей и одновременная регистрация одного email', async () => {
  for (const change of [{ email: 'bad' }, { role: 'admin' }, { name: '' }, { organization: '' }, { password: 'short' }, { passwordConfirm: 'different' }]) {
    await assert.rejects(register({ ...input, ...change }, memoryStore()), error => error.status === 400);
  }
  const store = memoryStore();
  const results = await Promise.allSettled([register(input, store), register(input, store)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(store.read().length, 1);
});
