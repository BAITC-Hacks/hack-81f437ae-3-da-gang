"""Uses a real migrated PostgreSQL database; only the paid AI calls are mocked."""
from uuid import UUID
from unittest.mock import AsyncMock
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from app.main import app
from app.api.schemas import Card, TaskAnalysis
from app.business_logic import ai
from app.data_access.database import Session, engine
from app.data_access.models import BusinessTask


async def test_end_to_end(monkeypatch):
    monkeypatch.setattr(ai, 'analyze', AsyncMock(return_value=TaskAnalysis(missing_fields=['users', 'data_and_materials', 'contact'], questions=['Кто пользователи?', 'Какие данные?', 'Как связаться?'])))
    monkeypatch.setattr(ai, 'generate', AsyncMock(return_value=Card(title='Очереди в клинике', context='Наша клиника', need='Уменьшить очереди')))
    task_id = None
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        try:
            analysis = await client.post('/api/tasks/analyze', json={'description': 'Хотим с помощью ИИ уменьшить очереди в нашей клинике.'})
            assert analysis.status_code == 200
            assert len(analysis.json()['questions']) >= 3
            generated = await client.post('/api/tasks/generate', json={'description': 'Очереди в клинике', 'answers': [{'question': q, 'answer': ''} for q in analysis.json()['questions']]})
            card = generated.json()
            created = await client.post('/api/tasks', json=card)
            assert created.status_code == 201, created.text
            task = created.json(); task_id = task['id']
            assert task['readiness_score'] == 20
            assert (await client.post(f'/api/tasks/{task_id}/publish')).status_code == 409
            assert (await client.post(f'/api/tasks/{task_id}/confirm')).status_code == 200
            card.update(users='Пациенты', data_and_materials='Обезличенный журнал', expected_result='Прототип расписания', success_criteria='Сократить ожидание на 20%', constraints='Без персональных данных', contact='test@example.com', interaction_format='Созвон')
            edited = (await client.put(f'/api/tasks/{task_id}', json=card)).json()
            assert edited['readiness_score'] == 100 and edited['status'] == 'draft'
            assert (await client.post(f'/api/tasks/{task_id}/publish')).status_code == 409
            await client.post(f'/api/tasks/{task_id}/confirm')
            assert (await client.post(f'/api/tasks/{task_id}/publish')).json()['status'] == 'published'
            catalog = (await client.get('/api/tasks')).json()
            scores = [t['readiness_score'] for t in catalog]
            assert scores == sorted(scores, reverse=True)
            assert task_id in [t['id'] for t in catalog]
            assert (await client.post(f'/api/proposals/{task_id}', json={'team_name': ' '})).status_code == 422
            proposal = {'team_name': 'Test team', 'solution_idea': 'Прогноз загрузки', 'plan': 'Анализ и прототип', 'estimated_time': '2 недели', 'prototype_url': 'https://example.com'}
            p = await client.post(f'/api/proposals/{task_id}', json=proposal)
            assert p.status_code == 201, p.text
            pid = p.json()['id']
            assert p.json()['status'] == 'pending'
            assert len((await client.get(f'/api/business/tasks/{task_id}/proposals')).json()) == 1
            assert (await client.patch(f'/api/business/proposals/{pid}', json={'status': 'accepted'})).json()['status'] == 'accepted'
            p2 = (await client.post(f'/api/proposals/{task_id}', json=proposal)).json()
            assert (await client.patch(f"/api/business/proposals/{p2['id']}", json={'status': 'accepted'})).json()['status'] == 'accepted'
            assert (await client.patch(f'/api/business/proposals/{pid}', json={'status': 'rejected'})).json()['status'] == 'rejected'
            assert (await client.get('/api/tasks/00000000-0000-0000-0000-999999999999')).status_code == 404
            assert (await client.get('/api/tasks/not-a-uuid')).status_code == 422
            # Low readiness remains visible, and re-editing invalidates publication.
            await client.put(f'/api/tasks/{task_id}', json={'title': 'Минимальная задача', 'topic': 'Тест'})
            await client.post(f'/api/tasks/{task_id}/confirm')
            await client.post(f'/api/tasks/{task_id}/publish')
            low = (await client.get('/api/tasks?level=draft&topic=Тест')).json()
            assert any(t['id'] == task_id and t['readiness_score'] == 0 for t in low)
        finally:
            if task_id:
                async with Session() as session:
                    await session.execute(delete(BusinessTask).where(BusinessTask.id == UUID(task_id)))
                    await session.commit()
            await engine.dispose()
