from app.api.schemas import Card
from app.api.workbench_schemas import QualityReview, CoachDraft, PilotSuggestions
from app.business_logic.ai import structured


def task_context(card: Card):
    # Contact details are unnecessary for reasoning about the task.
    return card.model_dump(exclude={'contact'})


async def review(card: Card) -> QualityReview:
    result = await structured(QualityReview, '''
Review clarity and actionability, never assign a score. Return at most 8 issues,
one per field. Ask a specific clarification question for each issue, never invent an answer.
Do not request personal or patient data. Do not evaluate the contact field.
missing: only for an empty field, quote and related fields must be null.
ambiguous: exact nonempty quote from that field, related fields null.
conflict: exact quotes from the field and a DIFFERENT related field.
Questions should expose uncertainty, not state unverified claims.
If the supplied task is clear, return an empty issues list.''', task_context(card))
    checked, seen = [], set()
    for issue in result.issues:
        if issue.field == 'contact' or issue.field in seen:
            continue
        value = getattr(card, issue.field) or ''
        if issue.kind == 'missing':
            valid = not value.strip() and issue.quote is None and issue.related_field is None and issue.related_quote is None
        else:
            valid = bool(issue.quote and issue.quote.strip() and issue.quote in value)
            if issue.kind == 'conflict':
                related = getattr(card, issue.related_field) if issue.related_field else None
                valid = valid and issue.related_field != issue.field and issue.related_field != 'contact' and bool(issue.related_quote and issue.related_quote.strip() and issue.related_quote in (related or ''))
            else:
                valid = valid and issue.related_field is None and issue.related_quote is None
        if valid:
            checked.append(issue)
            seen.add(issue.field)
    return QualityReview(issues=checked)


async def coach(card: Card, idea: str, plan: str) -> CoachDraft:
    return await structured(CoachDraft, '''
Help a student team structure its proposed solution. Output editable SUGGESTIONS, not facts or commitments.
Use only supplied task, idea and plan. Propose an approach and tentative steps.
Never invent team skills, achievements, available data, dates, duration, budget or promised metrics.
Do not change or generate team identity or contacts. Missing dependencies must become questions.
Use tentative wording for new recommendations. No automatic submission or team ranking.''',
        {'task': task_context(card), 'team_idea': idea, 'team_plan': plan})


async def pilot_suggestions(card: Card, proposal) -> PilotSuggestions:
    return await structured(PilotSuggestions, '''
Suggest a small pilot experiment for an ALREADY manually accepted proposal.
Return editable proposed steps and open questions only. These are suggestions to approve, not agreed commitments.
Do not invent access to data, team capabilities, metrics, deadlines, people, budget or responsibilities.
Missing prerequisites must be questions. Do not select or rank teams.
Do not repeat contact information.''',
        {'task': task_context(card), 'idea': proposal.solution_idea, 'plan': proposal.plan, 'estimated_time': proposal.estimated_time})
