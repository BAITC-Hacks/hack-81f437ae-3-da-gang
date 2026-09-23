from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal
from app.api.schemas import Card, FieldName, Text


class QualityIssue(BaseModel):
    field: FieldName
    kind: Literal['missing', 'ambiguous', 'conflict']
    quote: str | None
    related_field: FieldName | None
    related_quote: str | None
    question: Text


class QualityReview(BaseModel):
    issues: list[QualityIssue] = Field(max_length=8)


class CoachInput(BaseModel):
    solution_idea: Text
    plan: str = Field(default='', max_length=10000)


class CoachDraft(BaseModel):
    solution_idea: Text
    plan: Text
    questions: list[Text] = Field(max_length=6)


class PilotSuggestions(BaseModel):
    steps: list[Text] = Field(min_length=1, max_length=8)
    open_questions: list[Text] = Field(max_length=8)


class PilotDocument(BaseModel):
    objective: str = Field(default='', max_length=10000)
    expected_result: str = Field(default='', max_length=10000)
    success_criteria: str = Field(default='', max_length=10000)
    data_and_materials: str = Field(default='', max_length=10000)
    constraints: str = Field(default='', max_length=10000)
    business_responsibilities: str = Field(default='', max_length=10000)
    team_responsibilities: str = Field(default='', max_length=10000)
    timeline: str = Field(default='', max_length=10000)
    steps: list[Text] = Field(default_factory=list, max_length=12)
    open_questions: list[Text] = Field(default_factory=list, max_length=12)


class PilotSave(BaseModel):
    document: PilotDocument
    source_version: str = Field(min_length=64, max_length=64)


class PilotOut(BaseModel):
    document: PilotDocument
    source_version: str
    saved: bool
    confirmed: bool
    stale: bool
    team_name: str
    task_title: str | None
    task_id: str
    proposal_status: str
    updated_at: datetime
