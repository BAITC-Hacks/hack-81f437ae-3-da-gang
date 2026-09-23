"""Explicit live integration check: two paid API calls, no secret output."""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.api.schemas import GenerateInput, Answer
from app.business_logic.ai import analyze, generate
from fastapi import HTTPException


async def main():
    description = 'Хотим с помощью ИИ уменьшить очереди в нашей клинике.'
    analysis = await analyze(description)
    assert len(analysis.questions) >= 3
    facts = 'Пользователи — администраторы клиники. Есть обезличенный журнал времени приёма. Нужен прототип расписания.'
    card = await generate(GenerateInput(description=description, answers=[Answer(question=q, answer=facts if i == 0 else '') for i, q in enumerate(analysis.questions)]))
    assert card.contact is None, 'Contact must not be invented'
    assert card.success_criteria is None, 'Success criteria must not be invented'
    print('Live AI OK. Questions:', len(analysis.questions), 'Populated fields:', [k for k, v in card.model_dump().items() if v])


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except HTTPException as exc:
        print(f'Live AI failed ({exc.status_code}): {exc.detail}')
        sys.exit(1)
