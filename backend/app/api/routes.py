from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from app.api.schemas import AnalysisInput, TaskAnalysis, GenerateInput, Card, TaskOut, Rating, ProposalInput, ProposalOut, Decision
from app.business_logic import ai
from app.business_logic.rating import calculate_rating
from app.business_logic.tasks import TaskService, task_output
from app.data_access.database import get_session
from app.data_access.repository import Repository
from app.data_access.models import TeamProposal

router = APIRouter(prefix='/api')


def service(session=Depends(get_session)):
    return TaskService(Repository(session))


@router.post('/tasks/analyze', response_model=TaskAnalysis)
async def analyze(payload: AnalysisInput):
    return await ai.analyze(payload.description)


@router.post('/tasks/generate', response_model=Card)
async def generate(payload: GenerateInput):
    return await ai.generate(payload)


@router.post('/tasks/preview', response_model=Rating)
async def preview(card: Card):
    return calculate_rating(card)


@router.get('/tasks', response_model=list[TaskOut])
async def catalog(topic: str | None = None, level: Literal['draft', 'working', 'ready', 'priority'] | None = None,
                  sort: Literal['score', 'newest'] = 'score', svc=Depends(service)):
    return [task_output(t) for t in await svc.repo.tasks(topic=topic, level=level, sort=sort)]


@router.get('/business/tasks', response_model=list[TaskOut])
async def business_tasks(svc=Depends(service)):
    return [task_output(t) for t in await svc.repo.tasks(published=False)]


@router.post('/tasks', response_model=TaskOut, status_code=201)
async def create(card: Card, svc=Depends(service)):
    return task_output(await svc.create(card))


@router.get('/tasks/{task_id}', response_model=TaskOut)
async def details(task_id: UUID, svc=Depends(service)):
    return task_output(await svc.require(task_id))


@router.put('/tasks/{task_id}', response_model=TaskOut)
async def edit(task_id: UUID, card: Card, svc=Depends(service)):
    return task_output(await svc.edit(task_id, card))


@router.post('/tasks/{task_id}/{action}', response_model=TaskOut)
async def transition(task_id: UUID, action: Literal['confirm', 'publish'], svc=Depends(service)):
    return task_output(await svc.transition(task_id, action))


@router.get('/business/tasks/{task_id}/proposals', response_model=list[ProposalOut])
async def proposals(task_id: UUID, svc=Depends(service)):
    await svc.require(task_id)
    return await svc.repo.proposals(task_id)


@router.post('/proposals/{task_id}', response_model=ProposalOut, status_code=201)
async def propose(task_id: UUID, payload: ProposalInput, svc=Depends(service)):
    return await svc.propose(task_id, payload)


@router.patch('/business/proposals/{proposal_id}', response_model=ProposalOut)
async def decide(proposal_id: UUID, payload: Decision, svc=Depends(service)):
    proposal = await svc.repo.session.get(TeamProposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, 'Предложение не найдено')
    proposal.status = payload.status
    return await svc.repo.save(proposal)
