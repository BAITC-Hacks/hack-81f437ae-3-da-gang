from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from app.api.routes import service
from app.api.schemas import Card
from app.api.workbench_schemas import QualityReview, CoachInput, CoachDraft, PilotSave, PilotOut
from app.business_logic import workbench_ai
from app.business_logic.pilots import require_proposal, pilot_output, initial_document, source_version

router = APIRouter(prefix='/api')


@router.post('/tasks/review', response_model=QualityReview)
async def review(card: Card):
    return await workbench_ai.review(card)


@router.post('/tasks/{task_id}/proposal-coach', response_model=CoachDraft)
async def coach(task_id: UUID, payload: CoachInput, svc=Depends(service)):
    task = await svc.require(task_id)
    if task.status != 'published':
        raise HTTPException(409, 'Задача должна быть опубликована')
    return await workbench_ai.coach(Card.model_validate(task), payload.solution_idea, payload.plan)


@router.get('/business/proposals/{proposal_id}/pilot', response_model=PilotOut)
async def get_pilot(proposal_id: UUID, svc=Depends(service)):
    proposal, task = await require_proposal(svc, proposal_id)
    return pilot_output(task, proposal)


@router.post('/business/proposals/{proposal_id}/pilot/generate', response_model=PilotOut)
async def generate_pilot(proposal_id: UUID, svc=Depends(service)):
    proposal, task = await require_proposal(svc, proposal_id, accepted=True)
    document = initial_document(task, proposal)
    suggestions = await workbench_ai.pilot_suggestions(Card.model_validate(task), proposal)
    document.steps = suggestions.steps
    document.open_questions = suggestions.open_questions
    return pilot_output(task, proposal, document)


@router.put('/business/proposals/{proposal_id}/pilot', response_model=PilotOut)
async def save_pilot(proposal_id: UUID, payload: PilotSave, svc=Depends(service)):
    proposal, task = await require_proposal(svc, proposal_id, accepted=True)
    if payload.source_version != source_version(task, proposal):
        raise HTTPException(409, 'Исходная задача изменилась. Обновите страницу и проверьте план заново.')
    proposal.pilot_document = payload.document.model_dump()
    proposal.pilot_source_version = payload.source_version
    proposal.pilot_confirmed = False
    await svc.repo.save(proposal)
    return pilot_output(task, proposal)


@router.post('/business/proposals/{proposal_id}/pilot/confirm', response_model=PilotOut)
async def confirm_pilot(proposal_id: UUID, svc=Depends(service)):
    proposal, task = await require_proposal(svc, proposal_id, accepted=True)
    if task.status == 'draft':
        raise HTTPException(409, 'Сначала подтвердите изменённую карточку задачи')
    if proposal.pilot_document is None or proposal.pilot_source_version != source_version(task, proposal):
        raise HTTPException(409, 'Сначала проверьте и сохраните актуальный план')
    doc = proposal.pilot_document
    required = ('objective', 'expected_result', 'success_criteria', 'business_responsibilities', 'team_responsibilities', 'timeline')
    if any(not doc.get(k, '').strip() for k in required) or not doc.get('steps'):
        raise HTTPException(422, 'Заполните цель, результат, критерии, обязанности сторон, сроки и хотя бы один этап')
    proposal.pilot_confirmed = True
    await svc.repo.save(proposal)
    return pilot_output(task, proposal)
