import { test, expect } from "@playwright/test";

test("business draft → clarify → edit → publish → proposal → accept", async ({
  page,
}) => {
  const title = `Клиника — браузерное демо ${Date.now()}`;
  // Mock only paid AI endpoints. All persistence and decisions use the real backend.
  await page.route("**/api/tasks/analyze", (route) =>
    route.fulfill({
      json: {
        missing_fields: ["users", "data_and_materials", "contact"],
        questions: [
          "Кто будет использовать решение?",
          "Какие данные доступны?",
          "Как связаться с бизнесом?",
        ],
      },
    }),
  );
  await page.route("**/api/tasks/generate-with-sources", (route) =>
    route.fulfill({
      json: {
        card: {
          title,
          topic: "Здравоохранение",
          context: "Очереди в клинике",
          need: "Уменьшить очереди",
          users: null,
          data_and_materials: null,
          constraints: null,
          expected_result: null,
          success_criteria: null,
          contact: null,
          interaction_format: null,
        },
        sources: {
          need: {
            quote: "Уменьшить очереди",
            label: "Первоначальное описание",
            question: null,
          },
        },
      },
    }),
  );
  await page.goto("/create");
  await page
    .getByLabel("Первоначальное описание")
    .fill("Хотим с помощью ИИ уменьшить очереди в нашей клинике.");
  await page.getByRole("button", { name: "Уточнить с AI" }).click();
  await expect(page.getByText("Уточним важные детали")).toBeVisible();
  await page
    .getByLabel("1. Кто будет использовать решение?")
    .fill("Администраторы");
  await page.getByRole("button", { name: "Сформировать карточку" }).click();
  await expect(page.getByText("20/100", { exact: true })).toBeVisible();
  await page.getByText("Источник AI-поля: Первоначальное описание").click();
  await expect(page.locator("blockquote")).toHaveText("Уменьшить очереди");
  await page
    .getByLabel("Потребность бизнеса", { exact: true })
    .fill("Уменьшить время ожидания");
  await expect(
    page.getByText(
      "Изменено вручную · исходная цитата: Первоначальное описание",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить сведения" }).click();
  await expect(
    page.getByRole("button", { name: "Опубликовать" }),
  ).toBeEnabled();
  await page
    .getByLabel("Пользователи", { exact: true })
    .fill("Пациенты и администраторы");
  await page
    .getByLabel("Данные и материалы", { exact: true })
    .fill("Обезличенный журнал приёмов");
  await page
    .getByLabel("Ожидаемый результат", { exact: true })
    .fill("Прототип расписания");
  await page
    .getByLabel("Критерии успеха", { exact: true })
    .fill("Снизить ожидание на 20%");
  await page
    .getByLabel("Ограничения", { exact: true })
    .fill("Без персональных данных");
  await page.getByLabel("Контакт", { exact: true }).fill("demo@example.com");
  await page
    .getByLabel("Формат взаимодействия", { exact: true })
    .fill("Еженедельный созвон");
  await expect(page.getByText("100/100", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Опубликовать" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Подтвердить сведения" }).click();
  await expect(
    page.getByRole("button", { name: "Опубликовать" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const detailsUrl = page.url();
  await page.getByRole("link", { name: "← Каталог задач" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.goto(detailsUrl);
  await page.getByRole("button", { name: "Я команда", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Редактировать карточку" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Я команда", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Название команды").fill("Browser Team");
  await page.getByLabel("Идея решения").fill("Прогноз загрузки регистратуры");
  await page.getByLabel("План работы").fill("Анализ, прототип, проверка");
  await page.getByLabel("Оценка сроков").fill("2 недели");
  await page.getByRole("button", { name: "Отправить предложение" }).click();
  await expect(page.getByText("Предложение отправлено")).toBeVisible();
  await page.getByRole("button", { name: "Я бизнес", exact: true }).click();
  // A delayed initial task GET used to let StrictMode's old load restore pending
  // proposals after Accept. Delay the first load while the second can complete.
  let taskReads = 0;
  let slowLoad = Promise.resolve();
  const taskPath = new URL(detailsUrl).pathname;
  await page.route(`**/api${taskPath}`, async (route) => {
    const first = ++taskReads === 1;
    const response = await route.fetch();
    if (first) {
      slowLoad = new Promise((resolve) => setTimeout(resolve, 800));
      await slowLoad;
    }
    await route.fulfill({ response });
  });
  await page.getByRole("link", { name: "Предложения команд" }).click();
  await expect(page.getByText("Browser Team")).toBeVisible();
  await page.getByRole("button", { name: "Принять", exact: true }).click();
  await expect(page.getByText("Принято", { exact: true })).toBeVisible();
  await slowLoad;
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Карточки", exact: true }).click();
  await expect(page.getByText("Принято", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Отклонить", exact: true }).click();
  await page.getByRole("button", { name: "Сравнение", exact: true }).click();
  await expect(page.getByText("Отклонено", { exact: true })).toBeVisible();
});

test("AI unavailable leaves input and manual fallback available", async ({
  page,
}) => {
  await page.route("**/api/tasks/analyze", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "OpenAI сейчас недоступен" },
    }),
  );
  await page.goto("/create");
  await page.getByLabel("Первоначальное описание").fill("Очереди в клинике");
  await page.getByRole("button", { name: "Уточнить с AI" }).click();
  await expect(page.getByRole("alert")).toHaveText("OpenAI сейчас недоступен");
  await expect(page.getByLabel("Первоначальное описание")).toHaveValue(
    "Очереди в клинике",
  );
  await page.getByRole("button", { name: "Заполнить вручную" }).click();
  await expect(page.getByLabel("Контекст", { exact: true })).toHaveValue(
    "Очереди в клинике",
  );
});
