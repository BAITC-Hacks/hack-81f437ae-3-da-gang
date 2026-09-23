import { randomUUID } from 'node:crypto';

export const criteria = [
  { key: 'title', label: 'Понятное название', min: 8, weight: 10 },
  { key: 'problem', label: 'Проблема и её контекст', min: 40, weight: 25 },
  { key: 'outcome', label: 'Ожидаемый результат', min: 30, weight: 25 },
  { key: 'successCriteria', label: 'Критерии успеха', min: 20, weight: 20 },
  { key: 'resources', label: 'Данные и доступные ресурсы', min: 15, weight: 10 },
  { key: 'deadline', label: 'Срок выполнения', min: 5, weight: 10 },
];

export class DomainError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function clean(value, max = 5000) {
  if (typeof value !== 'string') throw new DomainError('Ожидается текстовое поле.');
  const result = value.trim();
  if (result.length > max) throw new DomainError(`Поле должно быть не длиннее ${max} символов.`);
  return result;
}

export function rate(task) {
  const checks = criteria.map(c => ({ ...c, passed: (task[c.key] ?? '').trim().length >= c.min }));
  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  return {
    score,
    level: score >= 90 ? 'Золото' : score >= 75 ? 'Серебро' : score >= 60 ? 'Бронза' : 'Черновик',
    checks,
    canPublish: score >= 60 && checks.slice(0, 3).every(c => c.passed),
  };
}

export function createTask(input) {
  const task = { id: randomUUID(), status: 'draft', createdAt: new Date().toISOString(), proposals: [], selectedProposalId: null };
  return updateTask(task, input);
}

export function updateTask(task, input) {
  if (task.status !== 'draft') throw new DomainError('Можно редактировать только черновики.', 409);
  const fields = Object.fromEntries(criteria.map(({ key }) => [key, clean(input[key] ?? task[key] ?? '', key === 'title' ? 160 : 5000)]));
  if (!fields.title) throw new DomainError('Укажите название задачи.');
  return { ...task, ...fields, updatedAt: new Date().toISOString() };
}

export function publishTask(task) {
  if (task.status !== 'draft') throw new DomainError('Задача уже опубликована.', 409);
  if (!rate(task).canPublish) throw new DomainError('Нужны рейтинг от 60, название, описание проблемы и ожидаемый результат.');
  return { ...task, status: 'published' };
}

export function addProposal(task, input) {
  if (task.status !== 'published') throw new DomainError('Приём откликов закрыт.', 409);
  const teamName = clean(input.teamName ?? '', 120);
  const message = clean(input.message ?? '', 3000);
  if (teamName.length < 2 || message.length < 20) throw new DomainError('Укажите команду и предложение от 20 символов.');
  if (task.proposals.some(p => p.teamName.toLowerCase() === teamName.toLowerCase())) {
    throw new DomainError('Эта команда уже оставила отклик.', 409);
  }
  const proposal = { id: randomUUID(), teamName, message, createdAt: new Date().toISOString() };
  return { ...task, proposals: [...task.proposals, proposal] };
}

export function selectTeam(task, proposalId) {
  if (task.status !== 'published') throw new DomainError('Команду можно выбрать только для открытой задачи.', 409);
  if (!task.proposals.some(p => p.id === proposalId)) throw new DomainError('Отклик не найден.', 404);
  return { ...task, status: 'matched', selectedProposalId: proposalId };
}

export const present = task => ({ ...task, rating: rate(task) });
