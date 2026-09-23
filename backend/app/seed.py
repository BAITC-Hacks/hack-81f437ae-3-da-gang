"""Idempotent demo fixtures. Existing user data is never overwritten."""
import asyncio
from uuid import UUID
from app.api.schemas import Card
from app.business_logic.rating import calculate_rating
from app.data_access.database import Session, engine
from app.data_access.models import BusinessTask, TeamProposal

CARDS = [
    dict(title='Меньше очередей в городской клинике', topic='Здравоохранение', context='Пациенты ждут приёма в регистратуре.', need='Сократить очереди в клинике.', users='Администраторы и пациенты.'),
    dict(title='Прогноз спроса для небольшой пекарни', topic='Ритейл', context='Каждый вечер остаётся непроданная выпечка.', need='Планировать объём выпечки.', data_and_materials='CSV с продажами за 6 месяцев.', expected_result='Таблица прогноза продаж на завтра.', constraints='Без интеграции с кассой на первом этапе.'),
    dict(title='Помощник для обращений студентов', topic='Образование', context='Деканат обрабатывает однотипные обращения.', need='Сократить время сортировки заявок.', users='Сотрудники деканата.', data_and_materials='200 обезличенных примеров обращений.', expected_result='Прототип классификатора заявок.', success_criteria='Не менее 85% точности на тестовых примерах.'),
    dict(title='Контроль расхода воды на ферме', topic='Агро', context='Расход воды фиксируется вручную.', need='Находить необычные скачки расхода.', users='Агрономы.', data_and_materials='Почасовые показания 4 датчиков за 3 месяца.', expected_result='Дашборд с графиками и отметками аномалий.', success_criteria='Обнаружить 9 из 10 размеченных утечек.', constraints='Прототип за 3 недели.', contact='Демо: farm@example.com', interaction_format='Еженедельный созвон с агрономом.'),
    dict(title='Маршруты доставки для местного магазина', topic='Логистика', context='Курьеры выбирают маршрут вручную.', need='Сократить время доставки.', users='Диспетчер и курьеры.', data_and_materials='Обезличенные адреса 50 заказов.', expected_result='Прототип построения маршрута.', constraints='Только один район города.', contact='Демо: delivery@example.com', interaction_format='Обратная связь по почте раз в неделю.'),
]


async def seed():
    async with Session() as session:
        for index, values in enumerate(CARDS, 1):
            task_id = UUID(int=index)
            if await session.get(BusinessTask, task_id) is None:
                card = Card(**values)
                session.add(BusinessTask(id=task_id, **card.model_dump(), status='published', readiness_score=calculate_rating(card).score))
        await session.flush()
        for index, team in enumerate(['Qadam AI', 'Sana Builders', 'Nomad Code', 'Data Qazaq', 'Steppe Labs'], 1):
            proposal_id = UUID(int=100 + index)
            if await session.get(TeamProposal, proposal_id) is None:
                session.add(TeamProposal(id=proposal_id, task_id=UUID(int=index), team_name=team,
                    solution_idea='Демо: создадим простой прототип на предоставленных бизнесом данных.',
                    plan='Уточнение задачи → анализ данных → прототип → проверка с бизнесом.', estimated_time='3 недели',
                    prototype_url=None, status='pending'))
        await session.commit()
    await engine.dispose()
    print('Demo: 5 tasks and 5 proposals are ready.')


if __name__ == '__main__':
    asyncio.run(seed())
