from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StringConstraints, field_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]
FieldName = Literal['title', 'topic', 'context', 'need', 'users', 'data_and_materials', 'constraints', 'expected_result', 'success_criteria', 'contact', 'interaction_format']


class Card(BaseModel):
    model_config = ConfigDict(extra='forbid', from_attributes=True)
    title: str | None = None
    topic: str | None = None
    context: str | None = None
    need: str | None = None
    users: str | None = None
    data_and_materials: str | None = None
    constraints: str | None = None
    expected_result: str | None = None
    success_criteria: str | None = None
    contact: str | None = None
    interaction_format: str | None = None

    @field_validator('*')
    @classmethod
    def clean(cls, value):
        if isinstance(value, str):
            if len(value) > 10000:
                raise ValueError('Поле не должно превышать 10000 символов')
            return value.strip() or None
        return value


class AnalysisInput(BaseModel):
    description: Text


class TaskAnalysis(BaseModel):
    missing_fields: list[FieldName]
    questions: list[Text] = Field(min_length=3, max_length=10)


class Answer(BaseModel):
    question: Text
    answer: str = Field(max_length=10000)


class GenerateInput(AnalysisInput):
    answers: list[Answer] = Field(min_length=3, max_length=10)


class EvidenceField(BaseModel):
    value: str | None
    source_quote: str | None


class GroundedCard(BaseModel):
    title: EvidenceField
    topic: EvidenceField
    context: EvidenceField
    need: EvidenceField
    users: EvidenceField
    data_and_materials: EvidenceField
    constraints: EvidenceField
    expected_result: EvidenceField
    success_criteria: EvidenceField
    contact: EvidenceField
    interaction_format: EvidenceField


class Rating(BaseModel):
    score: int
    level: Literal['draft', 'working', 'ready', 'priority']
    missing: list[str]
    improvements: list[str]


class TaskOut(Card):
    id: UUID
    status: Literal['draft', 'confirmed', 'published']
    readiness_score: int
    rating: Rating
    created_at: datetime
    updated_at: datetime


class ProposalInput(BaseModel):
    team_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    solution_idea: Text
    plan: Text
    estimated_time: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    prototype_url: HttpUrl | None = None


class ProposalOut(ProposalInput):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    status: Literal['pending', 'accepted', 'rejected']
    created_at: datetime
    updated_at: datetime


class Decision(BaseModel):
    status: Literal['accepted', 'rejected']
