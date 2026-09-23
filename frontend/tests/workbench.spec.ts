import { test, expect } from "@playwright/test";

test("quality → clarification → coached proposal → confirmed persisted pilot → PDF", async ({
  page,
}) => {
  const title = `Пекарня — пилот ${Date.now()}`;
  const taskResponse = await page.request.post("/api/tasks", {
    data: {
      title,
      topic: "Ритейл",
      context: "Остаётся выпечка",
      need: "Сделать лучше",
      users: "Пекарь",
      data_and_materials: "Обезличенная таблица продаж",
      expected_result: "Прототип прогноза",
      success_criteria: "Ошибка прогноза менее 20%",
      constraints: "Только тестовые данные",
    },
  });
  expect(taskResponse.status()).toBe(201);
  const task = await taskResponse.json();
  await page.request.post(`/api/tasks/${task.id}/confirm`);
  await page.request.post(`/api/tasks/${task.id}/publish`);
  let reviews = 0;
  await page.route("**/api/tasks/review", (route) => {
    reviews += 1;
    return route.fulfill({
      json: {
        issues:
          reviews === 1
            ? [
                {
                  field: "need",
                  kind: "ambiguous",
                  quote: "Сделать лучше",
                  related_field: null,
                  related_quote: null,
                  question: "Какой процесс нужно улучшить?",
                },
              ]
            : [],
      },
    });
  });
  await page.route("**/proposal-coach", (route) =>
    route.fulfill({
      json: {
        solution_idea: "Предлагаем проверить прогноз на таблице продаж",
        plan: "Сначала изучить данные, затем собрать прототип",
        questions: ["Кто проверит прогноз?"],
      },
    }),
  );
  await page.route("**/pilot/generate", async (route) => {
    const response = await page.request.get(
      route.request().url().replace("/generate", ""),
    );
    const current = await response.json();
    await route.fulfill({
      json: {
        ...current,
        saved: false,
        confirmed: false,
        document: {
          ...current.document,
          steps: ["Проверить прогноз на отложенных примерах"],
          open_questions: ["Когда доступны примеры?"],
        },
      },
    });
  });
  await page.goto(`/tasks/${task.id}/edit`);
  await page.getByRole("button", { name: "Разобрать качество с AI" }).click();
  await expect(page.getByText("Какой процесс нужно улучшить?")).toBeVisible();
  await page
    .getByLabel("Уточнение 1", { exact: true })
    .fill("Снизить остатки выпечки");
  await expect(
    page.getByLabel("Потребность бизнеса", { exact: true }),
  ).toHaveValue("Сделать лучше");
  await page
    .getByRole("button", { name: "Перенести ответы в карточку" })
    .click();
  await expect(
    page.getByLabel("Потребность бизнеса", { exact: true }),
  ).toHaveValue("Снизить остатки выпечки");
  expect(
    (await (await page.request.get(`/api/tasks/${task.id}`)).json()).need,
  ).toBe("Сделать лучше");
  await expect(
    page.getByRole("button", { name: "Перенести ответы в карточку" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Проверить ещё раз" }).click();
  await expect(page.getByText(/AI не вернул замечаний/)).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить сведения" }).click();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.getByRole("button", { name: "Я команда", exact: true }).click();
  await page.getByLabel("Название команды").fill("Pilot Team");
  await page.getByLabel("Идея решения").fill("Наш прогноз");
  await page.getByLabel("Оценка сроков").fill("2 недели");
  await page.getByRole("button", { name: "Улучшить предложение с AI" }).click();
  await expect(page.getByLabel("Идея решения")).toHaveValue("Наш прогноз");
  await page
    .getByLabel("Черновик плана", { exact: true })
    .fill("Наш проверенный план");
  await page.getByRole("button", { name: "Использовать в форме" }).click();
  await expect(page.getByLabel("План работы")).toHaveValue(
    "Наш проверенный план",
  );
  await page.getByRole("button", { name: "Отправить предложение" }).click();
  await expect(page.getByText("Предложение отправлено")).toBeVisible();
  await page.getByRole("button", { name: "Я бизнес", exact: true }).click();
  await page.getByRole("link", { name: "Предложения команд" }).click();
  await expect(
    page.getByRole("link", { name: "Подготовить пилот" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Принять", exact: true }).click();
  await page.getByRole("link", { name: "Подготовить пилот" }).click();
  await expect(
    page.getByRole("heading", { name: "План пилота", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Этап 1", { exact: true })).toHaveValue(
    "Наш проверенный план",
  );
  await page.getByRole("button", { name: "Предложить этапы с AI" }).click();
  await expect(
    page.getByText("Предложенные этапы — ещё не применены"),
  ).toBeVisible();
  await expect(page.getByLabel("Этап 1", { exact: true })).toHaveValue(
    "Наш проверенный план",
  );
  await page.getByRole("button", { name: "Перенести этапы в план" }).click();
  await expect(page.getByLabel("Этап 1", { exact: true })).toHaveValue(
    "Проверить прогноз на отложенных примерах",
  );
  await page
    .getByLabel("Обязанности бизнеса", { exact: true })
    .fill("Предоставить обезличенные примеры");
  await page
    .getByLabel("Обязанности команды", { exact: true })
    .fill("Подготовить и проверить прототип");
  await page
    .getByRole("button", { name: "Сохранить план", exact: true })
    .click();
  await page.getByRole("button", { name: "Подтвердить план пилота" }).click();
  await page.reload();
  await expect(
    page.getByText("План подтверждён бизнесом.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Обязанности команды", { exact: true }),
  ).toHaveValue("Подготовить и проверить прототип");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("header")).toBeHidden();
  await expect(page.locator(".print-only")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Предложить этапы с AI" }),
  ).toBeHidden();
  await page.pdf({
    path: "../.tools/pilot-demo.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "../.tools/pilot-editor.png", fullPage: true });
});
