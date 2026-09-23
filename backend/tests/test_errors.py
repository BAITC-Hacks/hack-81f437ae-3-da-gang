from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi import HTTPException
from openai import APIConnectionError
from pydantic import SecretStr, ValidationError
from sqlalchemy.exc import OperationalError
from app.api.schemas import TaskAnalysis
from app.business_logic import ai
from app.data_access.database import get_session
from app.main import app


def test_analysis_requires_distinct_questions():
    with pytest.raises(ValidationError):
        TaskAnalysis(missing_fields=[], questions=['Какие данные?', 'какие данные ?', 'Какие данные.'])
    result = TaskAnalysis(missing_fields=[], questions=['Кто пользователи?', 'Какие данные?', 'Какие данные ?', 'Как измерить успех?'])
    assert len(result.questions) == 3


@pytest.mark.parametrize('failure,status', [('network', 503), ('duplicate', 502)])
async def test_ai_failure_retries_once_without_secret_response(monkeypatch, failure, status):
    parse = AsyncMock()
    if failure == 'network':
        parse.side_effect = APIConnectionError(request=httpx.Request('POST', 'https://api.openai.com/v1/responses'))
    else:
        parse.return_value = SimpleNamespace(output_parsed={'missing_fields': [], 'questions': ['Какие данные?'] * 3})
    class Client:
        async def __aenter__(self):
            return SimpleNamespace(responses=SimpleNamespace(parse=parse))
        async def __aexit__(self, *args):
            pass
    monkeypatch.setattr(ai, 'AsyncOpenAI', lambda **kwargs: Client())
    monkeypatch.setattr(ai.settings, 'openai_api_key', SecretStr('test-secret-never-show'))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        response = await client.post('/api/tasks/analyze', json={'description': 'Тестовая задача'})
    assert response.status_code == status
    assert 'test-secret-never-show' not in response.text
    assert parse.await_count == 2


async def test_whitespace_key_is_not_sent(monkeypatch):
    monkeypatch.setattr(ai.settings, 'openai_api_key', SecretStr('   '))
    with pytest.raises(HTTPException) as error:
        await ai.analyze('Описание')
    assert error.value.status_code == 503


@pytest.mark.parametrize('error', [OperationalError('private sql', {}, Exception('private password')), OSError('private connection')])
async def test_health_exposes_database_failure_safely(error):
    session = SimpleNamespace(execute=AsyncMock(side_effect=error))
    async def broken_session():
        yield session
    app.dependency_overrides[get_session] = broken_session
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            response = await client.get('/api/health')
        assert response.status_code == 503
        assert 'private' not in response.text
    finally:
        app.dependency_overrides.pop(get_session, None)
