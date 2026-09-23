from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from pydantic import SecretStr
from app.api.schemas import Card, GenerateInput, GroundedCard, TaskAnalysis
from app.business_logic import ai


async def test_generation_drops_unsourced_facts(monkeypatch):
    result = {key: {'value': None, 'source_quote': None} for key in Card.model_fields}
    result['context'] = {'value': 'Очереди в клинике', 'source_quote': 'Очереди в клинике'}
    result['contact'] = {'value': 'invented@example.com', 'source_quote': 'invented@example.com'}
    result['users'] = {'value': 'Пациенты', 'source_quote': 'Очереди в клинике'}
    monkeypatch.setattr(ai, 'structured', AsyncMock(return_value=GroundedCard(**result)))
    payload = GenerateInput(description='Очереди в клинике', answers=[{'question': 'Что известно?', 'answer': ''}] * 3)
    card = await ai.generate(payload)
    assert card.context == 'Очереди в клинике'
    assert card.contact is None
    assert card.users is None


async def test_invalid_output_retries_once(monkeypatch):
    parse = AsyncMock(return_value=SimpleNamespace(output_parsed=None))
    class FakeClient:
        async def __aenter__(self):
            return SimpleNamespace(responses=SimpleNamespace(parse=parse))
        async def __aexit__(self, *args):
            pass
    monkeypatch.setattr(ai, 'AsyncOpenAI', lambda **kw: FakeClient())
    monkeypatch.setattr(ai.settings, 'openai_api_key', SecretStr('test-only'))
    with pytest.raises(HTTPException) as error:
        await ai.analyze('Очереди в клинике')
    assert error.value.status_code == 502
    assert parse.await_count == 2


async def test_missing_key_is_clear_error(monkeypatch):
    monkeypatch.setattr(ai.settings, 'openai_api_key', SecretStr(''))
    with pytest.raises(HTTPException) as error:
        await ai.analyze('Описание')
    assert error.value.status_code == 503


def test_questions_must_have_at_least_three():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        TaskAnalysis(missing_fields=['contact'], questions=['Контакт?'])


async def test_sources_are_resolved_from_answers_not_model_labels(monkeypatch):
    result = {key: {'value': None, 'source_quote': None} for key in Card.model_fields}
    result['context'] = {'value': 'Очереди в клинике', 'source_quote': 'Очереди в клинике'}
    result['users'] = {'value': 'Администраторы', 'source_quote': 'Администраторы'}
    result['contact'] = {'value': 'Кто пользователи?', 'source_quote': 'Кто пользователи?'}
    monkeypatch.setattr(ai, 'structured', AsyncMock(return_value=GroundedCard(**result)))
    payload = GenerateInput(description='Очереди в клинике', answers=[
        {'question': 'Какие данные?', 'answer': ''},
        {'question': 'Кто пользователи?', 'answer': 'Администраторы'},
        {'question': 'Как связаться?', 'answer': ''},
    ])
    generated = await ai.generate_with_sources(payload)
    assert generated.sources['context'].label == 'Первоначальное описание'
    assert generated.sources['users'].label == 'Ответ на вопрос № 2'
    assert generated.sources['users'].question == 'Кто пользователи?'
    assert generated.sources['users'].quote == generated.card.users
    assert generated.card.contact is None
    assert 'contact' not in generated.sources
