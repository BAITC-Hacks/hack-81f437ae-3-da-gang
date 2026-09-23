const $ = selector => document.querySelector(selector);
const form = $('#task-form');
let tasks = [];
let editingId = null;
const labels = { draft: 'Черновик', published: 'Открыта для откликов', matched: 'Команда выбрана' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function api(path, method = 'GET', data) {
  const response = await fetch(`/api/tasks${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function notice(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').className = error ? 'error' : 'success';
}

function card(task, business) {
  const e = escapeHtml;
  const rating = task.rating;
  const selected = task.proposals.find(p => p.id === task.selectedProposalId);
  return `<article class="panel task">
    <div class="card-top"><span class="badge">${e(labels[task.status])}</span><strong>${rating.score}/100 · ${e(rating.level)}</strong></div>
    <h3>${e(task.title)}</h3><p class="description">${e(task.problem || 'Описание пока не заполнено.')}</p>
    <details><summary>Карточка и оценка качества</summary>
      ${[['Результат', task.outcome], ['Критерии успеха', task.successCriteria], ['Ресурсы', task.resources], ['Срок', task.deadline]].map(([label, value]) => `<h4>${label}</h4><p class="description">${e(value || 'Не указано')}</p>`).join('')}
      <ul class="checks">${rating.checks.map(c => `<li>${c.passed ? '✓' : '○'} ${e(c.label)}: ${c.passed ? `+${c.weight}` : `нужно от ${c.min} символов`}</li>`).join('')}</ul>
    </details>
    ${selected ? `<p class="selected">Выбрана команда: ${e(selected.teamName)}</p>` : ''}
    ${business && task.status === 'draft' ? `<div class="actions"><button class="secondary" data-action="edit" data-id="${task.id}">Редактировать</button><button data-action="publish" data-id="${task.id}" ${rating.canPublish ? '' : 'disabled'}>Опубликовать</button></div>${rating.canPublish ? '' : '<p class="muted">Нужно 60 баллов, заполненные название, проблема и результат.</p>'}` : ''}
    ${business && task.status !== 'draft' ? `<h4>Отклики (${task.proposals.length})</h4>${task.proposals.map(p => `<div class="proposal"><strong>${e(p.teamName)}</strong><p class="description">${e(p.message)}</p>${task.status === 'published' ? `<button data-action="select" data-id="${task.id}" data-proposal="${p.id}">Выбрать команду</button>` : ''}</div>`).join('') || '<p class="muted">Пока нет откликов.</p>'}` : ''}
    ${!business && task.status === 'published' ? `<details><summary>Предложить решение</summary><form class="proposal-form" data-id="${task.id}"><label>Название команды<input name="teamName" required minlength="2" maxlength="120"></label><label>Ваш подход и опыт<textarea name="message" required minlength="20" maxlength="3000"></textarea></label><button type="submit">Отправить отклик</button></form></details>` : ''}
  </article>`;
}

async function refresh() {
  tasks = await api('');
  $('#business-list').innerHTML = tasks.map(t => card(t, true)).join('') || '<div class="empty">Начните с первой задачи — форма слева.</div>';
  $('#catalog-list').innerHTML = tasks.filter(t => t.status !== 'draft').map(t => card(t, false)).join('') || '<div class="empty">Пока нет опубликованных задач.</div>';
}

function reset() { editingId = null; form.reset(); $('#editor-title').textContent = 'Новая задача'; }
$('#reset-form').addEventListener('click', reset);
for (const mode of ['business', 'catalog']) {
  $(`#${mode}-tab`).addEventListener('click', () => {
    for (const name of ['business', 'catalog']) {
      $(`#${name}`).hidden = name !== mode;
      $(`#${name}-tab`).classList.toggle('active', name === mode);
      $(`#${name}-tab`).setAttribute('aria-pressed', String(name === mode));
    }
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const saved = await api(editingId ? `/${editingId}` : '', editingId ? 'PATCH' : 'POST', Object.fromEntries(new FormData(form)));
    editingId = saved.id;
    $('#editor-title').textContent = 'Редактирование черновика';
    await refresh();
    notice(`Черновик сохранён. Рейтинг: ${saved.rating.score}/100.`);
  } catch (error) { notice(error.message, true); }
  finally { button.disabled = false; }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id, proposal } = button.dataset;
  if (action === 'edit') {
    const task = tasks.find(t => t.id === id);
    editingId = id;
    for (const key of ['title', 'problem', 'outcome', 'successCriteria', 'resources', 'deadline']) form.elements[key].value = task[key];
    $('#editor-title').textContent = 'Редактирование черновика';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  button.disabled = true;
  try {
    await api(`/${id}/${action}`, 'POST', action === 'select' ? { proposalId: proposal } : {});
    if (editingId === id) reset();
    await refresh();
    notice(action === 'publish' ? 'Задача опубликована в каталоге.' : 'Команда выбрана. Приём откликов закрыт.');
  } catch (error) { notice(error.message, true); button.disabled = false; }
});

document.addEventListener('submit', async event => {
  if (!event.target.matches('.proposal-form')) return;
  event.preventDefault();
  const proposalForm = event.target;
  const button = proposalForm.querySelector('button');
  button.disabled = true;
  try {
    await api(`/${proposalForm.dataset.id}/proposals`, 'POST', Object.fromEntries(new FormData(proposalForm)));
    await refresh();
    notice('Отклик отправлен. Решение принимает представитель бизнеса.');
  } catch (error) { notice(error.message, true); button.disabled = false; }
});

refresh().catch(error => notice(`Не удалось загрузить задачи: ${error.message}`, true));
