import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  api,
  labels,
  levels,
  statuses,
  emptyCard,
  cardOnly,
  type Card,
  type Rating,
  type Task,
  type Analysis,
  type Proposal,
  type ProposalInput,
} from "./api";
import "./styles.css";

function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error" role="alert">
      {message}
    </div>
  ) : null;
}
function Badge({ rating }: { rating: Rating }) {
  return (
    <span className={`badge ${rating.level}`}>
      {rating.score}/100 · {levels[rating.level]}
    </span>
  );
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Произошла ошибка");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function App() {
  return (
    <BrowserRouter>
      <header>
        <Link className="brand" to="/">
          <span className="brand-mark">S</span>
          <span>
            AI Sana<small>CHALLENGE HUB</small>
          </span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Каталог задач
          </NavLink>
          <NavLink to="/business">Кабинет бизнеса</NavLink>
          <Link className="button" to="/create">
            + Создать задачу
          </Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/create" element={<Create />} />
          <Route path="/tasks/:id" element={<Details />} />
          <Route path="/tasks/:id/edit" element={<Edit />} />
          <Route path="/business" element={<Catalog business />} />
          <Route path="/business/:id/proposals" element={<Proposals />} />
          <Route
            path="*"
            element={
              <p>
                Страница не найдена. <Link to="/">В каталог</Link>
              </p>
            }
          />
        </Routes>
      </main>
      <footer>
        <span>AI Sana Challenge Hub</span>
        <span>Бизнес ставит задачу. Команды создают решения.</span>
        <span>Демо · без регистрации</span>
      </footer>
    </BrowserRouter>
  );
}

function Catalog({ business = false }: { business?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]),
    [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState(""),
    [level, setLevel] = useState(""),
    [sort, setSort] = useState("score");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ sort });
    if (topic) params.set("topic", topic);
    if (level) params.set("level", level);
    Promise.all([
      api<Task[]>(
        business ? "/business/tasks" : `/tasks?${params}`,
        "GET",
        undefined,
        controller.signal,
      ),
      api<Task[]>("/tasks", "GET", undefined, controller.signal),
    ])
      .then(([items, all]) => {
        setTasks(items);
        setTopics([
          ...new Set(all.map((t) => t.topic).filter((t): t is string => !!t)),
        ]);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [business, topic, level, sort, retry]);
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">
            {business
              ? "ПРОСТРАНСТВО БИЗНЕСА"
              : "ОТ РЕАЛЬНОЙ ЗАДАЧИ К РЕАЛЬНОМУ РЕШЕНИЮ"}
          </p>
          <h1>
            {business
              ? "Ваши задачи.\nНовые возможности."
              : "Большие идеи начинаются\nс хорошей задачи."}
          </h1>
          <p>
            {business
              ? "Уточняйте задачи, публикуйте карточки и выбирайте команды самостоятельно."
              : "Находите вызовы бизнеса, предлагайте решения и превращайте знания в полезный опыт."}
          </p>
          <Link className="button light" to="/create">
            Описать задачу <span>↗</span>
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit" />
          <span className="spark">✳</span>
          <span className="art-label">БИЗНЕС + ТАЛАНТ + AI</span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {business ? "УПРАВЛЕНИЕ" : "ДОСТУПНЫЕ ВЫЗОВЫ"}
          </p>
          <h2>
            {business ? "Кабинет бизнеса" : "Каталог задач"}{" "}
            <span className="count">{tasks.length}</span>
          </h2>
        </div>
        <span className="muted">
          {business
            ? "Общий демо-кабинет без авторизации"
            : "Рейтинг отражает полноту описания"}
        </span>
      </div>
      {!business && (
        <div className="filters">
          <label>
            Отрасль
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Все отрасли</option>
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Готовность
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Все уровни</option>
              {Object.entries(levels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сортировка
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="score">Сначала высокий рейтинг</option>
              <option value="newest">Сначала новые</option>
            </select>
          </label>
        </div>
      )}
      <ErrorBox message={error} />
      {error && (
        <button onClick={() => setRetry((v) => v + 1)}>
          Повторить загрузку
        </button>
      )}
      {loading ? (
        <p className="empty" role="status">
          Загружаем задачи…
        </p>
      ) : !error && tasks.length === 0 ? (
        <div className="empty">
          Пока нет задач. Измените фильтры или создайте первую.
        </div>
      ) : (
        <div className="task-grid">
          {tasks.map((task) => (
            <article className="task-card" key={task.id}>
              <div className="card-top">
                <span className="topic">{task.topic || "Без отрасли"}</span>
                <span className="arrow">↗</span>
              </div>
              <Link to={`/tasks/${task.id}`}>
                <h3>{task.title || "Задача без названия"}</h3>
              </Link>
              <p className="excerpt">
                {task.need || task.context || "Описание ещё уточняется"}
              </p>
              <div className="card-bottom">
                <Badge rating={task.rating} />
                <span className="muted">
                  {new Date(task.created_at).toLocaleDateString("ru-RU")}
                </span>
              </div>
              {business && (
                <div className="management">
                  <span>{statuses[task.status]}</span>
                  <Link to={`/tasks/${task.id}/edit`}>Редактировать</Link>
                  <Link to={`/business/${task.id}/proposals`}>
                    Предложения →
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <aside className="note">
        ✧ AI помогает уточнить задачу. Публикацию и выбор команды всегда
        подтверждает человек.
      </aside>
    </>
  );
}

function Create() {
  const [description, setDescription] = useState(""),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [answers, setAnswers] = useState<string[]>([]),
    [card, setCard] = useState<Card | null>(null);
  const { busy, error, run } = useAction();
  if (card) return <Editor initial={card} />;
  return (
    <div className="narrow">
      <p className="eyebrow">СОЗДАНИЕ ЗАДАЧИ</p>
      <h1>Расскажите о вашем вызове</h1>
      <div className="steps">
        <span className={!analysis ? "active" : ""}>01 · Описание</span>
        <span className={analysis ? "active" : ""}>02 · Уточнение</span>
        <span>03 · Карточка</span>
      </div>
      <section className="panel">
        <h2>
          {analysis
            ? "Уточним важные детали"
            : "Начните с нескольких предложений"}
        </h2>
        <p className="muted">
          AI использует только ваши сведения. Неизвестное можно пропустить и
          заполнить позже.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!analysis) {
                const result = await api<Analysis>("/tasks/analyze", "POST", {
                  description,
                });
                setAnalysis(result);
                setAnswers(result.questions.map(() => ""));
              } else {
                setCard(
                  await api<Card>("/tasks/generate", "POST", {
                    description,
                    answers: analysis.questions.map((question, i) => ({
                      question,
                      answer: answers[i],
                    })),
                  }),
                );
              }
            });
          }}
        >
          <label>
            Первоначальное описание
            <textarea
              required
              maxLength={10000}
              rows={5}
              value={description}
              disabled={!!analysis || busy}
              placeholder="Хотим с помощью ИИ уменьшить очереди в нашей клинике."
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {analysis && (
            <>
              <p className="note">
                Не хватает:{" "}
                {analysis.missing_fields.map((f) => labels[f]).join(", ") ||
                  "уточнения деталей"}
                .
              </p>
              {analysis.questions.map((q, i) => (
                <label key={i}>
                  {i + 1}. {q}
                  <textarea
                    maxLength={10000}
                    rows={3}
                    value={answers[i]}
                    disabled={busy}
                    placeholder="Ответьте или оставьте пустым, если пока неизвестно"
                    onChange={(e) =>
                      setAnswers(
                        answers.map((a, j) => (i === j ? e.target.value : a)),
                      )
                    }
                  />
                </label>
              ))}
            </>
          )}
          <ErrorBox message={error} />
          <div className="actions">
            <button className="button" disabled={busy || !description.trim()}>
              {busy
                ? "AI работает…"
                : analysis
                  ? "Сформировать карточку"
                  : "Уточнить с AI ✧"}
            </button>
            {analysis && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAnalysis(null)}
              >
                Изменить описание
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setCard({ ...emptyCard, context: description || null })
              }
            >
              Заполнить вручную
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Editor({ initial, task }: { initial: Card; task?: Task }) {
  const [card, setCard] = useState<Card>(cardOnly(initial)),
    [saved, setSaved] = useState<Task | undefined>(task),
    [dirty, setDirty] = useState(!task);
  const [rating, setRating] = useState<Rating | null>(task?.rating || null),
    [ratingError, setRatingError] = useState(""),
    [notice, setNotice] = useState("");
  const { busy, error, run } = useAction();
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    setRating(null);
    setRatingError("");
    const timer = setTimeout(() => {
      api<Rating>("/tasks/preview", "POST", card, controller.signal)
        .then(setRating)
        .catch((e) => {
          if (!controller.signal.aborted) setRatingError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [card]);
  async function save() {
    const result = await api<Task>(
      saved ? `/tasks/${saved.id}` : "/tasks",
      saved ? "PUT" : "POST",
      card,
    );
    setSaved(result);
    setDirty(false);
    setNotice("Черновик сохранён");
    return result;
  }
  return (
    <>
      <p className="eyebrow">03 · ПРОВЕРКА И ПОДТВЕРЖДЕНИЕ</p>
      <h1>Карточка вашей задачи</h1>
      <p className="muted">
        Проверьте все поля. Сохранение изменений возвращает карточку в черновик
        до нового подтверждения.
      </p>
      <div className="editor-layout">
        <section className="panel">
          <div className="section-heading">
            <h2>Информация о задаче</h2>
            <span className="topic">
              {dirty
                ? "Есть несохранённые изменения"
                : saved
                  ? statuses[saved.status]
                  : "Черновик"}
            </span>
          </div>
          <fieldset disabled={busy}>
            {(Object.keys(labels) as (keyof Card)[]).map((key) => (
              <label key={key}>
                {labels[key]}
                {key === "title" ? (
                  <input
                    aria-label={labels[key]}
                    maxLength={10000}
                    value={card[key] || ""}
                    onChange={(e) => {
                      setCard({ ...card, [key]: e.target.value });
                      setDirty(true);
                      setNotice("");
                    }}
                  />
                ) : (
                  <textarea
                    aria-label={labels[key]}
                    maxLength={10000}
                    rows={key === "topic" || key === "contact" ? 2 : 3}
                    value={card[key] || ""}
                    placeholder="Пока не указано"
                    onChange={(e) => {
                      setCard({ ...card, [key]: e.target.value });
                      setDirty(true);
                      setNotice("");
                    }}
                  />
                )}
              </label>
            ))}
          </fieldset>
          <ErrorBox message={error} />
          {notice && (
            <p className="success" role="status">
              {notice}
            </p>
          )}
          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await save();
                })
              }
            >
              Сохранить черновик
            </button>
            <button
              className="button"
              disabled={busy || !card.title?.trim()}
              onClick={() =>
                void run(async () => {
                  const current = dirty || !saved ? await save() : saved;
                  const result = await api<Task>(
                    `/tasks/${current.id}/confirm`,
                    "POST",
                  );
                  setSaved(result);
                  setNotice(
                    "Вы подтвердили карточку. Теперь её можно опубликовать.",
                  );
                })
              }
            >
              Подтвердить сведения
            </button>
            <button
              className="button"
              disabled={busy || dirty || saved?.status !== "confirmed"}
              onClick={() =>
                void run(async () => {
                  const result = await api<Task>(
                    `/tasks/${saved!.id}/publish`,
                    "POST",
                  );
                  navigate(`/tasks/${result.id}`);
                })
              }
            >
              Опубликовать →
            </button>
          </div>
        </section>
        <aside className="panel rating-panel">
          <p className="eyebrow">ГОТОВНОСТЬ ЗАДАЧИ</p>
          {rating ? (
            <>
              <div className="score">
                {rating.score}
                <span>/100</span>
              </div>
              <Badge rating={rating} />
              <div className="meter">
                <div style={{ width: `${rating.score}%` }} />
              </div>
              <h3>
                {rating.improvements.length
                  ? "Как повысить рейтинг"
                  : "Все сведения заполнены"}
              </h3>
              <ul>
                {rating.improvements.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
              {rating.missing.length > 0 && (
                <p className="muted">
                  Не заполнено:{" "}
                  {rating.missing
                    .map((f) => labels[f as keyof Card])
                    .join(", ")}
                  .
                </p>
              )}
            </>
          ) : (
            <p role="status">{ratingError || "Пересчитываем…"}</p>
          )}
          <p className="muted">
            Рейтинг рассчитывается по заполненности полей, а не AI. Даже задачу
            с низким рейтингом можно опубликовать.
          </p>
        </aside>
      </div>
    </>
  );
}

function Edit() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<Task>(`/tasks/${id}`, "GET", undefined, c.signal)
      .then(setTask)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id]);
  return error ? (
    <ErrorBox message={error} />
  ) : task ? (
    <Editor key={task.id} initial={task} task={task} />
  ) : (
    <p>Загрузка…</p>
  );
}

function Details() {
  const { id } = useParams();
  const [task, setTask] = useState<Task | null>(null),
    [loadError, setLoadError] = useState("");
  const [proposal, setProposal] = useState<ProposalInput>({
      team_name: "",
      solution_idea: "",
      plan: "",
      estimated_time: "",
      prototype_url: null,
    }),
    [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();
  useEffect(() => {
    const c = new AbortController();
    api<Task>(`/tasks/${id}`, "GET", undefined, c.signal)
      .then(setTask)
      .catch((e) => {
        if (!c.signal.aborted) setLoadError(e.message);
      });
    return () => c.abort();
  }, [id]);
  if (!task)
    return loadError ? <ErrorBox message={loadError} /> : <p>Загрузка…</p>;
  return (
    <>
      <Link className="back" to="/">
        ← Каталог задач
      </Link>
      <p className="eyebrow">
        {task.topic || "БИЗНЕС-ЗАДАЧА"} · {statuses[task.status]}
      </p>
      <h1>{task.title || "Задача без названия"}</h1>
      <Badge rating={task.rating} />
      <div className="actions">
        <Link to={`/tasks/${id}/edit`}>Редактировать карточку</Link>
        <Link to={`/business/${id}/proposals`}>Предложения команд →</Link>
      </div>
      <div className="editor-layout">
        <section className="panel">
          {(Object.keys(labels) as (keyof Card)[])
            .filter((k) => k !== "title" && k !== "topic")
            .map((k) => (
              <div className="detail-field" key={k}>
                <h3>{labels[k]}</h3>
                <p className={!task[k] ? "muted" : ""}>
                  {task[k] || "Пока не указано"}
                </p>
              </div>
            ))}
        </section>
        <section className="panel proposal-panel">
          <p className="eyebrow">ДЛЯ СТУДЕНЧЕСКИХ КОМАНД</p>
          <h2>Предложите решение</h2>
          {task.status !== "published" ? (
            <p>Предложения откроются после публикации.</p>
          ) : sent ? (
            <div className="success" role="status">
              <h3>Предложение отправлено</h3>
              <p>Бизнес рассмотрит его и примет решение вручную.</p>
              <button
                onClick={() => {
                  setSent(false);
                  setProposal({
                    team_name: "",
                    solution_idea: "",
                    plan: "",
                    estimated_time: "",
                    prototype_url: null,
                  });
                }}
              >
                Отправить ещё одно
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api(`/proposals/${id}`, "POST", proposal);
                  setSent(true);
                });
              }}
            >
              <fieldset disabled={busy}>
                {(
                  [
                    ["team_name", "Название команды"],
                    ["solution_idea", "Идея решения"],
                    ["plan", "План работы"],
                    ["estimated_time", "Оценка сроков"],
                    ["prototype_url", "Ссылка на прототип (необязательно)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    {key === "solution_idea" || key === "plan" ? (
                      <textarea
                        required
                        rows={3}
                        maxLength={10000}
                        value={proposal[key]}
                        onChange={(e) =>
                          setProposal({ ...proposal, [key]: e.target.value })
                        }
                      />
                    ) : (
                      <input
                        required={key !== "prototype_url"}
                        type={key === "prototype_url" ? "url" : "text"}
                        maxLength={key === "prototype_url" ? 2000 : 200}
                        value={proposal[key] || ""}
                        onChange={(e) =>
                          setProposal({
                            ...proposal,
                            [key]: e.target.value || null,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
              </fieldset>
              <ErrorBox message={error} />
              <button className="button" disabled={busy}>
                {busy ? "Отправляем…" : "Отправить предложение →"}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

function Proposals() {
  const { id } = useParams();
  const [items, setItems] = useState<Proposal[]>([]),
    [task, setTask] = useState<Task | null>(null),
    [loading, setLoading] = useState(true);
  const { busy, error, run } = useAction();
  useEffect(() => {
    void run(async () => {
      try {
        const [t, p] = await Promise.all([
          api<Task>(`/tasks/${id}`),
          api<Proposal[]>(`/business/tasks/${id}/proposals`),
        ]);
        setTask(t);
        setItems(p);
      } finally {
        setLoading(false);
      }
    });
  }, [id]);
  async function decision(item: Proposal, status: "accepted" | "rejected") {
    await run(async () => {
      const changed = await api<Proposal>(
        `/business/proposals/${item.id}`,
        "PATCH",
        { status },
      );
      setItems(items.map((p) => (p.id === changed.id ? changed : p)));
    });
  }
  return (
    <>
      <Link className="back" to="/business">
        ← Кабинет бизнеса
      </Link>
      <p className="eyebrow">РЕШЕНИЕ ПРИНИМАЕТ БИЗНЕС</p>
      <h1>Предложения команд</h1>
      <p className="muted">
        {task?.title} · Можно принять несколько команд или отклонить все
        предложения.
      </p>
      <ErrorBox message={error} />
      {loading ? (
        <p>Загрузка…</p>
      ) : !error && !items.length ? (
        <div className="empty">
          Пока нет предложений. Команды смогут откликнуться на опубликованную
          задачу.
        </div>
      ) : (
        items.map((item) => (
          <article className="panel proposal" key={item.id}>
            <div className="section-heading">
              <h2>{item.team_name}</h2>
              <span
                className={`badge ${item.status === "accepted" ? "priority" : "draft"}`}
              >
                {
                  {
                    pending: "Ожидает решения",
                    accepted: "Принято",
                    rejected: "Отклонено",
                  }[item.status]
                }
              </span>
            </div>
            <h3>Идея</h3>
            <p>{item.solution_idea}</p>
            <h3>План</h3>
            <p>{item.plan}</p>
            <p>
              <strong>Сроки:</strong> {item.estimated_time}
            </p>
            {item.prototype_url && (
              <a href={item.prototype_url} target="_blank" rel="noreferrer">
                Открыть прототип ↗
              </a>
            )}
            <div className="actions">
              <button
                className="button"
                disabled={busy || item.status === "accepted"}
                onClick={() => void decision(item, "accepted")}
              >
                Принять
              </button>
              <button
                disabled={busy || item.status === "rejected"}
                onClick={() => void decision(item, "rejected")}
              >
                Отклонить
              </button>
            </div>
          </article>
        ))
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
