import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, labels, type Card, type ProposalInput } from "./api";

type Issue = {
  field: keyof Card;
  kind: "missing" | "ambiguous" | "conflict";
  quote: string | null;
  related_field: keyof Card | null;
  related_quote: string | null;
  question: string;
};
type Review = { issues: Issue[] };
type CoachDraft = { solution_idea: string; plan: string; questions: string[] };

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить действие";
}
function ErrorMessage({ value }: { value: string }) {
  return value ? (
    <p className="error" role="alert">
      {value}
    </p>
  ) : null;
}

export function QualityPanel({
  card,
  disabled,
  apply,
}: {
  card: Card;
  disabled: boolean;
  apply: (card: Card) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [answers, setAnswers] = useState<Partial<Record<keyof Card, string>>>(
    {},
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stale = !!review && snapshot !== JSON.stringify(card);
  async function analyze() {
    setBusy(true);
    setError("");
    const current = JSON.stringify(card);
    try {
      const result = await api<Review>("/tasks/review", "POST", card);
      setReview(result);
      setSnapshot(current);
      setAnswers({});
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function applyAnswers() {
    const next = { ...card };
    for (const issue of review?.issues || []) {
      const answer = answers[issue.field]?.trim();
      if (answer) next[issue.field] = answer;
    }
    apply(next);
  }
  return (
    <section className="panel quality-panel no-print">
      <p className="eyebrow">ОТ ЗАПОЛНЕННОСТИ К ПОНЯТНОЙ ЗАДАЧЕ</p>
      <h2>Что ещё уточнить?</h2>
      <p className="muted">
        AI проверит расплывчатые формулировки и возможные противоречия. Это
        вопросы для проверки, а не оценка достоверности. Числовой рейтинг не
        меняется от самого анализа.
      </p>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => void analyze()}
      >
        {busy
          ? "Проверяем формулировки…"
          : review
            ? "Проверить ещё раз"
            : "Разобрать качество с AI"}
      </button>
      <ErrorMessage value={error} />
      {stale && (
        <p className="note" role="status">
          Карточка изменилась. Запустите повторную проверку, чтобы вопросы
          учитывали новые сведения.
        </p>
      )}
      {review && !review.issues.length && (
        <p className="success">
          AI не вернул замечаний с проверяемыми источниками. Это не гарантирует
          полноту задачи — проверьте её самостоятельно.
        </p>
      )}
      {review?.issues.map((issue, index) => (
        <article className="quality-issue" key={issue.field}>
          <span className="topic">
            {labels[issue.field]} ·{" "}
            {
              {
                missing: "Не хватает сведений",
                ambiguous: "Нужно уточнение",
                conflict: "Возможное противоречие",
              }[issue.kind]
            }
          </span>
          <h3>{issue.question}</h3>
          {issue.quote && <blockquote>{issue.quote}</blockquote>}
          {issue.related_field && (
            <p className="muted">
              {labels[issue.related_field]}: «{issue.related_quote}»
            </p>
          )}
          <label>
            Уточнённое значение: {labels[issue.field]}
            <textarea
              aria-label={`Уточнение ${index + 1}`}
              rows={3}
              maxLength={10000}
              value={answers[issue.field] || ""}
              disabled={stale || busy || disabled}
              onChange={(e) =>
                setAnswers({ ...answers, [issue.field]: e.target.value })
              }
              placeholder={
                card[issue.field] || "Впишите только известные вам сведения"
              }
            />
          </label>
          {answers[issue.field]?.trim() && (
            <p className="muted">
              Это значение заменит поле «{labels[issue.field]}» после вашего
              подтверждения.
            </p>
          )}
        </article>
      ))}
      {!!review?.issues.length && (
        <button
          type="button"
          className="button"
          disabled={
            busy ||
            disabled ||
            stale ||
            !Object.values(answers).some((a) => a?.trim())
          }
          onClick={applyAnswers}
        >
          Перенести ответы в карточку
        </button>
      )}
    </section>
  );
}

export function ProposalCoach({
  taskId,
  proposal,
  disabled,
  apply,
}: {
  taskId: string;
  proposal: ProposalInput;
  disabled: boolean;
  apply: (idea: string, plan: string) => void;
}) {
  const [draft, setDraft] = useState<CoachDraft | null>(null),
    [snapshot, setSnapshot] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const current = JSON.stringify([proposal.solution_idea, proposal.plan]);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      setDraft(
        await api<CoachDraft>(`/tasks/${taskId}/proposal-coach`, "POST", {
          solution_idea: proposal.solution_idea,
          plan: proposal.plan,
        }),
      );
      setSnapshot(current);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="coach no-print">
      <h3>Помочь оформить предложение?</h3>
      <p className="muted">
        Сначала введите свою идею выше. AI предложит структуру, не назначая
        сроки и не обещая возможности команды.
      </p>
      <button
        type="button"
        disabled={busy || disabled || !proposal.solution_idea.trim()}
        onClick={() => void generate()}
      >
        {busy ? "Готовим черновик…" : "Улучшить предложение с AI"}
      </button>
      <ErrorMessage value={error} />
      {draft && (
        <>
          <p className="note">
            Предлагаемый подход — проверьте и отредактируйте. Ничего ещё не
            отправлено бизнесу.
          </p>
          {current !== snapshot && (
            <p className="note">
              Исходное предложение изменилось. Сгенерируйте новый вариант перед
              применением.
            </p>
          )}
          <label>
            Черновик идеи
            <textarea
              aria-label="Черновик идеи"
              maxLength={10000}
              value={draft.solution_idea}
              onChange={(e) =>
                setDraft({ ...draft, solution_idea: e.target.value })
              }
            />
          </label>
          <label>
            Черновик плана
            <textarea
              aria-label="Черновик плана"
              rows={5}
              maxLength={10000}
              value={draft.plan}
              onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
            />
          </label>
          <h3>Вопросы бизнесу</h3>
          <ul>
            {draft.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={
              busy ||
              disabled ||
              current !== snapshot ||
              !draft.solution_idea.trim() ||
              !draft.plan.trim()
            }
            onClick={() => {
              apply(draft.solution_idea, draft.plan);
              setDraft(null);
            }}
          >
            Использовать в форме
          </button>
        </>
      )}
    </div>
  );
}

const pilotLabels = {
  objective: "Цель пилота",
  expected_result: "Результат пилота",
  success_criteria: "Как измерим успех",
  data_and_materials: "Данные и доступы",
  constraints: "Ограничения пилота",
  business_responsibilities: "Обязанности бизнеса",
  team_responsibilities: "Обязанности команды",
  timeline: "Сроки пилота",
};
type PilotDocument = Record<keyof typeof pilotLabels, string> & {
  steps: string[];
  open_questions: string[];
};
type Pilot = {
  document: PilotDocument;
  source_version: string;
  saved: boolean;
  confirmed: boolean;
  stale: boolean;
  team_name: string;
  task_title: string | null;
  task_id: string;
  proposal_status: string;
  updated_at: string;
};

export function PilotEditor() {
  const { id } = useParams();
  const [pilot, setPilot] = useState<Pilot | null>(null),
    [document, setDocument] = useState<PilotDocument | null>(null);
  const [candidate, setCandidate] = useState<Pilot | null>(null);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    api<Pilot>(
      `/business/proposals/${id}/pilot`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        setPilot(result);
        setDocument(result.document);
        setDirty(!result.saved);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
      });
    return () => controller.abort();
  }, [id]);
  if (!pilot || !document)
    return (
      <>
        <h1>План пилота</h1>
        {error ? <ErrorMessage value={error} /> : <p>Загружаем…</p>}
      </>
    );
  const editable = pilot.proposal_status === "accepted";
  const confirmed = pilot.confirmed && !dirty;
  function change(key: keyof PilotDocument, value: string | string[]) {
    setDocument((current) =>
      current ? { ...current, [key]: value } : current,
    );
    setDirty(true);
    setNotice("");
  }
  async function save() {
    const result = await api<Pilot>(`/business/proposals/${id}/pilot`, "PUT", {
      document,
      source_version: pilot!.source_version,
    });
    setPilot(result);
    setDirty(false);
    setNotice("Черновик пилота сохранён. Для завершения подтвердите план.");
  }
  return (
    <div className="pilot-page">
      <Link
        className="back no-print"
        to={`/business/${pilot.task_id}/proposals`}
      >
        ← К предложениям команды
      </Link>
      <p className="eyebrow">ОТ ЗАДАЧИ К ПРОВЕРКЕ РЕШЕНИЯ</p>
      <h1>План пилота</h1>
      <p>
        {pilot.task_title} · {pilot.team_name}
      </p>
      <div className="journey no-print">
        <span>01 · Задача сформулирована</span>
        <span>02 · Команда {editable ? "принята" : "не принята"}</span>
        <span className="active">
          03 · {confirmed ? "План подтверждён" : "Проверка плана"}
        </span>
      </div>
      <p className={confirmed ? "success" : "note"} role="status">
        {confirmed
          ? "План подтверждён бизнесом. Это не подтверждение согласия команды."
          : "Черновик. Проверьте факты и обсудите обязательства с командой."}
      </p>
      {pilot.stale && (
        <p className="error">
          Исходная задача или предложение изменились. Сверьте документ с{" "}
          <Link to={`/tasks/${pilot.task_id}`} target="_blank" rel="noreferrer">
            актуальной карточкой ↗
          </Link>
          , сохраните и подтвердите заново.
        </p>
      )}
      {!editable && (
        <p className="error">
          Предложение сейчас не принято. Изменять и подтверждать пилот можно
          после ручного принятия команды.
        </p>
      )}
      <ErrorMessage value={error} />
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <section className="panel no-print">
        <h2>Подготовьте проверку гипотезы</h2>
        <p className="muted">
          Факты взяты из карточки и предложения. AI может предложить этапы и
          вопросы; неизвестные обязанности сторон вы заполняете вручную.
        </p>
        <div className="actions">
          <button
            disabled={busy || !editable}
            onClick={() =>
              void run(async () => {
                setCandidate(
                  await api<Pilot>(
                    `/business/proposals/${id}/pilot/generate`,
                    "POST",
                  ),
                );
              })
            }
          >
            {busy ? "Подождите…" : "Предложить этапы с AI"}
          </button>
          <button disabled={busy} onClick={() => window.print()}>
            Печать / PDF
          </button>
        </div>
        {candidate && (
          <div className="pilot-candidate">
            <h3>Предложенные этапы — ещё не применены</h3>
            <ol>
              {candidate.document.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <h3>Открытые вопросы</h3>
            <ul>
              {candidate.document.open_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
            <p className="muted">
              Кнопка заменит только этапы и открытые вопросы. Остальные поля
              сохранят ваши правки.
            </p>
            <button
              disabled={busy || !editable}
              onClick={() => {
                setDocument({
                  ...document,
                  steps: candidate.document.steps,
                  open_questions: candidate.document.open_questions,
                });
                setCandidate(null);
                setDirty(true);
              }}
            >
              Перенести этапы в план
            </button>
            <button disabled={busy} onClick={() => setCandidate(null)}>
              Оставить мой план
            </button>
          </div>
        )}
        <fieldset disabled={busy || !editable}>
          {(Object.keys(pilotLabels) as (keyof typeof pilotLabels)[]).map(
            (key) => (
              <label key={key}>
                {pilotLabels[key]}
                <textarea
                  aria-label={pilotLabels[key]}
                  rows={3}
                  maxLength={10000}
                  value={document[key]}
                  onChange={(e) => change(key, e.target.value)}
                  placeholder="Не указано — уточните у участников"
                />
              </label>
            ),
          )}
          {(["steps", "open_questions"] as const).map((key) => (
            <div className="pilot-list" key={key}>
              <h3>{key === "steps" ? "Этапы пилота" : "Открытые вопросы"}</h3>
              {document[key].map((value, i) => (
                <div className="list-row" key={i}>
                  <textarea
                    aria-label={`${key === "steps" ? "Этап" : "Открытый вопрос"} ${i + 1}`}
                    maxLength={10000}
                    value={value}
                    onChange={(e) =>
                      change(
                        key,
                        document[key].map((text, j) =>
                          i === j ? e.target.value : text,
                        ),
                      )
                    }
                  />
                  <button
                    aria-label={`Удалить ${key === "steps" ? "этап" : "вопрос"} ${i + 1}`}
                    onClick={() =>
                      change(
                        key,
                        document[key].filter((_, j) => i !== j),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                disabled={document[key].length >= 12}
                onClick={() => change(key, [...document[key], ""])}
              >
                {key === "steps" ? "Добавить этап" : "Добавить вопрос"}
              </button>
            </div>
          ))}
        </fieldset>
        <div className="actions">
          <button disabled={busy || !editable} onClick={() => void run(save)}>
            Сохранить план
          </button>
          <button
            className="button"
            disabled={
              busy ||
              !editable ||
              dirty ||
              !pilot.saved ||
              pilot.stale ||
              confirmed
            }
            onClick={() =>
              void run(async () => {
                const result = await api<Pilot>(
                  `/business/proposals/${id}/pilot/confirm`,
                  "POST",
                );
                setPilot(result);
                setNotice("Вы подтвердили план пилота.");
              })
            }
          >
            Подтвердить план пилота
          </button>
        </div>
        <p className="muted">
          Для подтверждения нужны цель, результат, критерии успеха, обязанности
          обеих сторон, сроки и хотя бы один непустой этап. Любое редактирование
          требует нового сохранения и подтверждения.
        </p>
      </section>
      <section className="print-only">
        {(Object.keys(pilotLabels) as (keyof typeof pilotLabels)[]).map(
          (key) => (
            <div key={key}>
              <h2>{pilotLabels[key]}</h2>
              <p>{document[key] || "Не указано"}</p>
            </div>
          ),
        )}
        <h2>Этапы пилота</h2>
        <ol>
          {document.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <h2>Открытые вопросы</h2>
        <ul>
          {document.open_questions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
