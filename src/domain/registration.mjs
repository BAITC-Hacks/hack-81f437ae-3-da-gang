import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { DomainError } from './tasks.mjs';

const hashPassword = promisify(scrypt);

export async function register(input, store) {
  const text = key => typeof input[key] === 'string' ? input[key].trim() : '';
  const name = text('name');
  const email = text('email').toLowerCase();
  const organization = text('organization');
  const role = text('role');
  const password = typeof input.password === 'string' ? input.password : '';
  if (name.length < 2 || name.length > 100) throw new DomainError('Имя должно содержать от 2 до 100 символов.');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError('Введите корректный email.');
  if (!['business', 'student'].includes(role)) throw new DomainError('Выберите роль.');
  if (organization.length < 2 || organization.length > 160) throw new DomainError('Укажите название компании или команды: от 2 до 160 символов.');
  if (password.length < 8 || password.length > 128) throw new DomainError('Пароль должен содержать от 8 до 128 символов.');
  if (password !== input.passwordConfirm) throw new DomainError('Пароли не совпадают.');
  if (store.read().some(user => user.email === email)) throw new DomainError('Этот email уже зарегистрирован.', 409);
  const salt = randomBytes(16).toString('hex');
  const passwordHash = (await hashPassword(password, salt, 64)).toString('hex');
  // Читаем заново после асинхронного хеширования, чтобы не потерять параллельную регистрацию.
  const users = store.read();
  if (users.some(user => user.email === email)) throw new DomainError('Этот email уже зарегистрирован.', 409);
  const user = { id: randomUUID(), name, email, role, organization, createdAt: new Date().toISOString() };
  store.write([...users, { ...user, salt, passwordHash }]);
  return user;
}
