from unittest.mock import AsyncMock
from uuid import UUID
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from app.api.schemas import Card
from app.api.workbench_schemas import QualityReview, PilotSuggestions, CoachDraft
from app.business_logic import workbench_ai
from app.data_access.database import Session, engine
from app.data_access.models import BusinessTask
from app.main import app


async def test_quality_checks_evidence_and_excludes_contacts(monkeypatch):
    result = QualityReview(issues=[
        {'field': 'need', 'kind': 'ambiguous', 'quote': 'Стало лучше', 'related_field': None, 'related_quote': None, 'question': 'Как измерить улучшение?'},
        {'field': 'users', 'kind': 'missing', 'quote': None, 'related_field': None, 'related_quote': None, 'question': 'Кто будет пользоваться?'},
        {'field': 'constraints', 'kind': 'conflict', 'quote': 'Без бюджета', 'related_field': 'expected_result', 'related_quote': 'Платный сервис', 'question': 'Как согласовать эти условия?'},
        {'field': 'contact', 'kind': 'missing', 'quote': None, 'related_field': None, 'related_quote': None, 'question': 'Как связаться?'},
        {'field': 'context', 'kind': 'ambiguous', 'quote': 'Выдуманная цитата', 'related_field': None, 'related_quote': None, 'question': 'Почему?'},
        {'field': 'title', 'kind': 'missing', 'quote': None, 'related_field': None, 'related_quote': None, 'question': 'Название?'},
        {'field': 'need', 'kind': 'missing', 'quote': None, 'related_field': None, 'related_quote': None, 'question': 'Дубликат?'},
    ])
    mock = AsyncMock(return_value=result)
    monkeypatch.setattr(workbench_ai, 'structured', mock)
    card = Card(title='Тест', need='Стало лучше', constraints='Без бюджета', expected_result='Платный сервис', contact='private@example.com')
    checked = await workbench_ai.review(card)
    assert [i.field for i in checked.issues] == ['need', 'users', 'constraints']
    assert 'contact' not in mock.call_args.args[2]


async def test_pilot_lifecycle_and_coach(monkeypatch):
    monkeypatch.setattr(workbench_ai, 'pilot_suggestions', AsyncMock(return_value=PilotSuggestions(steps=['Проверить прототип на согласованных примерах'], open_questions=['Кто предоставит примеры?'])))
    monkeypatch.setattr(workbench_ai, 'coach', AsyncMock(return_value=CoachDraft(solution_idea='Предлагаем проверить гипотезу', plan='Уточнить данные и собрать прототип', questions=['Есть ли примеры?'])))
    task_id = None
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        try:
            card = {'title': 'Пилот — тест', 'need': 'Проверить гипотезу', 'expected_result': 'Прототип', 'success_criteria': '9 верных ответов из 10'}
            task = (await client.post('/api/tasks', json=card)).json(); task_id = task['id']
            await client.post(f'/api/tasks/{task_id}/confirm')
            await client.post(f'/api/tasks/{task_id}/publish')
            coach = await client.post(f'/api/tasks/{task_id}/proposal-coach', json={'solution_idea': 'Прототип'})
            assert coach.status_code == 200, coach.text
            assert coach.json()['questions'] == ['Есть ли примеры?']
            proposal = (await client.post(f'/api/proposals/{task_id}', json={'team_name': 'Тест', 'solution_idea': 'Наш подход', 'plan': 'Наш план', 'estimated_time': '2 недели'})).json()
            pid = proposal['id']; path = f'/api/business/proposals/{pid}/pilot'
            assert (await client.post(path + '/generate')).status_code == 409
            workbench_ai.pilot_suggestions.assert_not_awaited()
            await client.patch(f'/api/business/proposals/{pid}', json={'status': 'accepted'})
            draft = (await client.post(path + '/generate')).json()
            assert draft['saved'] is False and draft['confirmed'] is False
            assert draft['document']['business_responsibilities'] == ''
            assert draft['document']['timeline'] == '2 недели'
            assert draft['document']['success_criteria'] == card['success_criteria']
            assert (await client.get(path)).json()['document']['steps'] == ['Наш план']
            payload = {'document': draft['document'], 'source_version': draft['source_version']}
            assert (await client.put(path, json=payload)).status_code == 200
            assert (await client.post(path + '/confirm')).status_code == 422
            payload['document'].update(business_responsibilities='Предоставить примеры', team_responsibilities='Подготовить прототип')
            await client.put(path, json=payload)
            assert (await client.post(path + '/confirm')).json()['confirmed'] is True
            assert (await client.get(path)).json()['confirmed'] is True
            card['success_criteria'] = '10 верных ответов из 10'
            await client.put(f'/api/tasks/{task_id}', json=card)
            changed = (await client.get(path)).json()
            assert changed['stale'] is True and changed['confirmed'] is False
            assert (await client.post(path + '/confirm')).status_code == 409
            assert (await client.put(path, json=payload)).status_code == 409
            await client.post(f'/api/tasks/{task_id}/confirm')
            changed = (await client.get(path)).json()
            payload['source_version'] = changed['source_version']
            payload['document']['success_criteria'] = card['success_criteria']
            await client.put(path, json=payload)
            assert (await client.post(path + '/confirm')).json()['confirmed'] is True
            # An ordinary edit always removes confirmation.
            assert (await client.put(path, json=payload)).json()['confirmed'] is False
            await client.patch(f'/api/business/proposals/{pid}', json={'status': 'rejected'})
            assert (await client.put(path, json=payload)).status_code == 409
            assert (await client.post(path + '/confirm')).status_code == 409
            assert (await client.get(path)).json()['confirmed'] is False
            assert (await client.get('/api/business/proposals/00000000-0000-0000-0000-999999999999/pilot')).status_code == 404
        finally:
            if task_id:
                async with Session() as session:
                    await session.execute(delete(BusinessTask).where(BusinessTask.id == UUID(task_id)))
                    await session.commit()
            await engine.dispose()
