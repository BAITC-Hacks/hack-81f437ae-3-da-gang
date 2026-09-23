# LLM-модуль Sana Quest

```text
POST /api/llm/analyze
  → route.js: HTTP и ограничение размера
  → schema.js: проверка ввода
  → prompts.js: системный промпт + данные пользователя
  → service.js: выбор провайдера, таймаут, fallback
  → providers/mock.js или providers/remote.js
  → schema.js: проверка ответа
  → вопросы + явный режим работы
```

Доступны mock-провайдер с тематическими вопросами и адаптер Ollama в remote.js. По умолчанию включён mock; реальный запуск модели не проверен. Интерфейс приложения пока использует свои локальные вопросы; серверный модуль можно вызывать отдельно. GitHub Pages не исполняет этот API: для LLM понадобится отдельный сервер. Полная инструкция: [QUICKSTART.md](QUICKSTART.md).

Самостоятельный запуск из корня репозитория: `cd llm`, затем `node server.js`. API доступен на http://localhost:3001. Зависимости устанавливать не нужно. Проверки: `node --test` из папки llm. По умолчанию `LLM_PROVIDER=mock`. В PowerShell переменная задаётся командой `$env:LLM_PROVIDER="mock"`. `.env.example` — образец, автоматической загрузки `.env` нет.

Проверка в PowerShell:

```powershell
$body = @{ draft = 'Кофейня хочет точнее планировать закупки'; fields = @{} } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3001/api/llm/analyze -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Пример формата ответа (mock возвращает семь вопросов):
```json
{"questions":[{"field":"context","text":"Что происходит сейчас и что нужно изменить?"},{"field":"data","text":"Какие данные доступны?"},{"field":"success","text":"Как измерить успех?"}],"mode":"mock","fallback":false}
```

Для подключения установленной модели Ollama задайте LLM_PROVIDER=remote, LLM_MODEL и при необходимости LLM_BASE_URL. Адаптер вызывает /api/chat с stream=false и format=json. Таймаут 15 секунд; ошибки или неверная схема приводят к явно обозначенному mock-ответу. Сообщения провайдера и секреты не возвращаются клиенту.

POST /api/llm/card собирает карточку из присланных пользователем полей без вызова модели. Пропуски остаются пустыми, подтверждения сброшены. Рейтинг и решения бизнеса не меняются. Проверка схемы не гарантирует смысловую корректность: вопросы требуют проверки человеком. Перед публичным размещением API нужны авторизация и ограничение частоты запросов.
