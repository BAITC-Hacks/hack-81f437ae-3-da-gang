from fastapi import HTTPException
from app.api.schemas import Card, TaskOut
from app.business_logic.rating import calculate_rating
from app.data_access.models import BusinessTask, TeamProposal


def task_output(task):
    card = Card.model_validate(task)
    return TaskOut(**card.model_dump(), id=task.id, status=task.status,
                   readiness_score=task.readiness_score, rating=calculate_rating(card),
                   created_at=task.created_at, updated_at=task.updated_at)


class TaskService:
    def __init__(self, repository):
        self.repo = repository

    async def require(self, task_id):
        task = await self.repo.task(task_id)
        if task is None:
            raise HTTPException(404, 'Задача не найдена')
        return task

    async def create(self, card):
        return await self.repo.save(BusinessTask(**card.model_dump(), readiness_score=calculate_rating(card).score))

    async def edit(self, task_id, card):
        task = await self.require(task_id)
        for key, value in card.model_dump().items():
            setattr(task, key, value)
        task.readiness_score = calculate_rating(card).score
        # Changed facts require a fresh human confirmation before publication.
        task.status = 'draft'
        return await self.repo.save(task)

    async def transition(self, task_id, action):
        task = await self.require(task_id)
        if action == 'confirm':
            if not task.title:
                raise HTTPException(422, 'Перед подтверждением добавьте название задачи')
            if task.status != 'published':
                task.status = 'confirmed'
        else:
            if task.status == 'draft':
                raise HTTPException(409, 'Сначала вручную подтвердите карточку')
            task.status = 'published'
        return await self.repo.save(task)

    async def propose(self, task_id, payload):
        task = await self.require(task_id)
        if task.status != 'published':
            raise HTTPException(409, 'Предложения принимаются только для опубликованных задач')
        return await self.repo.save(TeamProposal(task_id=task_id, **payload.model_dump(mode='json')))
