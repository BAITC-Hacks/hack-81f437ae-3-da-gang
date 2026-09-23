import hashlib
import json
from fastapi import HTTPException
from app.api.schemas import Card
from app.api.workbench_schemas import PilotDocument, PilotOut
from app.data_access.models import TeamProposal


async def require_proposal(svc, proposal_id, accepted=False):
    proposal = await svc.repo.session.get(TeamProposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, 'Предложение не найдено')
    if accepted and proposal.status != 'accepted':
        raise HTTPException(409, 'Сначала бизнес должен принять предложение команды')
    task = await svc.require(proposal.task_id)
    return proposal, task


def source_version(task, proposal):
    facts = {'task': Card.model_validate(task).model_dump(), 'task_status': task.status,
             'proposal': {k: getattr(proposal, k) for k in ('team_name', 'solution_idea', 'plan', 'estimated_time', 'prototype_url', 'status')}}
    return hashlib.sha256(json.dumps(facts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def initial_document(task, proposal):
    return PilotDocument(objective=task.need or '', expected_result=task.expected_result or '',
        success_criteria=task.success_criteria or '', data_and_materials=task.data_and_materials or '',
        constraints=task.constraints or '', timeline=proposal.estimated_time,
        steps=[proposal.plan] if proposal.plan else [])


def pilot_output(task, proposal, document=None):
    version = source_version(task, proposal)
    saved = document is None and proposal.pilot_document is not None
    stale = saved and proposal.pilot_source_version != version
    return PilotOut(document=document if document is not None else PilotDocument(**proposal.pilot_document) if saved else initial_document(task, proposal),
        source_version=version, saved=saved, confirmed=bool(saved and proposal.pilot_confirmed and not stale and proposal.status == 'accepted'),
        stale=stale, task_id=str(task.id), task_title=task.title, team_name=proposal.team_name,
        proposal_status=proposal.status, updated_at=proposal.updated_at)
