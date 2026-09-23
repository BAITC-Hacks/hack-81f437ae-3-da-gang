from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.data_access.models import BusinessTask, TeamProposal


class Repository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def task(self, task_id: UUID):
        return await self.session.get(BusinessTask, task_id)

    async def tasks(self, published=True, topic=None, level=None, sort='score'):
        query = select(BusinessTask)
        if published:
            query = query.where(BusinessTask.status == 'published')
        if topic:
            query = query.where(BusinessTask.topic == topic)
        if level:
            low, high = {'draft': (0, 39), 'working': (40, 69), 'ready': (70, 89), 'priority': (90, 100)}[level]
            query = query.where(BusinessTask.readiness_score.between(low, high))
        order = [BusinessTask.readiness_score.desc(), BusinessTask.created_at.desc()] if sort == 'score' else [BusinessTask.created_at.desc()]
        return (await self.session.scalars(query.order_by(*order, BusinessTask.id))).all()

    async def save(self, item):
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def proposals(self, task_id):
        return (await self.session.scalars(select(TeamProposal).where(TeamProposal.task_id == task_id).order_by(TeamProposal.created_at.desc()))).all()
