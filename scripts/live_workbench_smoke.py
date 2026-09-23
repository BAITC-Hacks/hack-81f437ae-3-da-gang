"""Opt-in paid test: three OpenAI calls with hardcoded fictional bakery data only."""
import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from fastapi import HTTPException
from app.api.schemas import Card
from app.business_logic.workbench_ai import review, coach, pilot_suggestions


async def main():
    # No records, contacts, files or business data are read from the database.
    # The SDK obtains its credential from .env; it is never printed.
    card = Card(title='Вымышленная учебная пекарня', context='Учебный пример: остаётся выпечка.',
                need='Сделать лучше', expected_result='Учебный прототип прогноза',
                success_criteria='Чтобы стало лучше', data_and_materials='Синтетическая таблица продаж')
    quality = await review(card)
    assert quality.issues, 'Expected clarification questions for this deliberately vague fixture'
    draft = await coach(card, 'Предлагаем проверить прогноз по синтетическим продажам.', '')
    assert draft.solution_idea and draft.plan
    proposal = SimpleNamespace(solution_idea='Учебный прогноз', plan='Изучить синтетические примеры и собрать прототип', estimated_time='Срок не определён')
    suggestions = await pilot_suggestions(card, proposal)
    assert suggestions.steps
    print('Live workbench OK:', len(quality.issues), 'quality questions;', len(draft.questions), 'team questions;', len(suggestions.steps), 'pilot steps.')


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except HTTPException as exc:
        print(f'Live workbench failed ({exc.status_code}): {exc.detail}')
        sys.exit(1)
