export const labels = {
  title: "Название задачи",
  topic: "Отрасль / тема",
  context: "Контекст",
  need: "Потребность бизнеса",
  users: "Пользователи",
  data_and_materials: "Данные и материалы",
  constraints: "Ограничения",
  expected_result: "Ожидаемый результат",
  success_criteria: "Критерии успеха",
  contact: "Контакт",
  interaction_format: "Формат взаимодействия",
};
export type Card = Record<keyof typeof labels, string | null>;
export type Sources = Partial<
  Record<keyof Card, { quote: string; label: string; question: string | null }>
>;
export type GeneratedCard = { card: Card; sources: Sources };
export type Level = "draft" | "working" | "ready" | "priority";
export type Rating = {
  score: number;
  level: Level;
  missing: string[];
  improvements: string[];
};
export type Task = Card & {
  id: string;
  status: "draft" | "confirmed" | "published";
  readiness_score: number;
  rating: Rating;
  created_at: string;
  updated_at: string;
};
export type Analysis = { missing_fields: (keyof Card)[]; questions: string[] };
export type ProposalInput = {
  team_name: string;
  solution_idea: string;
  plan: string;
  estimated_time: string;
  prototype_url: string | null;
};
export type Proposal = ProposalInput & {
  id: string;
  task_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};
export const levels: Record<Level, string> = {
  draft: "Черновая",
  working: "В проработке",
  ready: "Готова к работе",
  priority: "Приоритетная",
};
export const statuses = {
  draft: "Черновик",
  confirmed: "Подтверждена",
  published: "Опубликована",
};
export const emptyCard = Object.fromEntries(
  Object.keys(labels).map((k) => [k, null]),
) as Card;
export function cardOnly(task: Card): Card {
  return Object.fromEntries(
    Object.keys(labels).map((k) => [k, task[k as keyof Card]]),
  ) as Card;
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new Error(
      "Не удалось связаться с сервером. Проверьте, что backend запущен.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(
                (e: { loc: string[]; msg: string }) =>
                  `${e.loc.slice(1).join(".")}: ${e.msg}`,
              )
              .join("; ")
          : "Сервис недоступен. Повторите попытку.",
    );
  }
  return data as T;
}
