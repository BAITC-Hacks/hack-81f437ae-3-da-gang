import { test, expect } from '@playwright/test';

test('live OpenAI demo from description to accepted proposal', async ({ page }) => {
  test.skip(process.env.LIVE_AI !== '1', 'Opt-in: makes two paid OpenAI calls');
  test.setTimeout(240000);
  const title = `Клиника · проверка AI ${Date.now()}`;
  await page.goto('/create');
  await page.getByLabel('Первоначальное описание').fill('Хотим с помощью ИИ уменьшить очереди в нашей клинике.');
  await page.getByRole('button', { name: 'Уточнить с AI' }).click();
  await expect(page.getByRole('heading', { name: 'Уточним важные детали' })).toBeVisible({ timeout: 100000 });
  const answers = page.locator('textarea:enabled');
  expect(await answers.count()).toBeGreaterThanOrEqual(3);
  await answers.first().fill('Пользователи — администраторы клиники. Остальные сведения пока неизвестны.');
  await page.getByRole('button', { name: 'Сформировать карточку' }).click();
  await expect(page.getByRole('heading', { name: 'Карточка вашей задачи' })).toBeVisible({ timeout: 100000 });
  await expect(page.getByLabel('Контакт', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Критерии успеха', { exact: true })).toHaveValue('');
  await page.getByLabel('Название задачи', { exact: true }).fill(title);
  await expect(page.locator('.score')).toContainText('/100');
  const before = Number((await page.locator('.score').innerText()).split('/')[0]);
  expect(before).toBeLessThan(70);
  await page.getByRole('button', { name: 'Подтвердить сведения' }).click();
  await expect(page.getByRole('button', { name: 'Опубликовать' })).toBeEnabled();
  const fields = {
    'Отрасль / тема': 'Здравоохранение', 'Контекст': 'Пациенты ожидают приёма в клинике.',
    'Потребность бизнеса': 'Сократить очереди.', 'Пользователи': 'Администраторы и пациенты.',
    'Данные и материалы': 'Обезличенный журнал приёмов за месяц.', 'Ограничения': 'Без персональных данных, прототип за 2 недели.',
    'Ожидаемый результат': 'Прототип расписания.', 'Критерии успеха': 'Сократить среднее ожидание на 20%.',
    'Контакт': 'clinic-demo@example.com', 'Формат взаимодействия': 'Еженедельный созвон.'
  };
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
  await expect(page.getByText('100/100', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Подтвердить сведения' }).click();
  await expect(page.getByRole('button', { name: 'Опубликовать' })).toBeEnabled();
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const detailsUrl = page.url();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.screenshot({ path: '../.tools/catalog-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../.tools/catalog-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(detailsUrl);
  await page.getByLabel('Название команды').fill('Sana Live Demo');
  await page.getByLabel('Идея решения').fill('Помощник планирования приёмов');
  await page.getByLabel('План работы').fill('Анализ журнала, прототип, проверка с клиникой');
  await page.getByLabel('Оценка сроков').fill('2 недели');
  await page.getByRole('button', { name: 'Отправить предложение' }).click();
  await expect(page.getByText('Предложение отправлено')).toBeVisible();
  await page.getByRole('link', { name: 'Предложения команд' }).click();
  await page.getByRole('button', { name: 'Принять', exact: true }).click();
  await expect(page.getByText('Принято', { exact: true })).toBeVisible();
});
