import uuid
from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, Uuid, func, JSON, Boolean, false
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BusinessTask(Timestamps, Base):
    __tablename__ = 'business_tasks'
    __table_args__ = (
        CheckConstraint("status IN ('draft','confirmed','published')", name='task_status'),
        CheckConstraint('readiness_score BETWEEN 0 AND 100', name='score_range'),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(Text, index=True)
    context: Mapped[str | None] = mapped_column(Text)
    need: Mapped[str | None] = mapped_column(Text)
    users: Mapped[str | None] = mapped_column(Text)
    data_and_materials: Mapped[str | None] = mapped_column(Text)
    constraints: Mapped[str | None] = mapped_column(Text)
    expected_result: Mapped[str | None] = mapped_column(Text)
    success_criteria: Mapped[str | None] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(Text)
    interaction_format: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='draft', index=True)
    readiness_score: Mapped[int] = mapped_column(default=0, index=True)


class TeamProposal(Timestamps, Base):
    __tablename__ = 'team_proposals'
    __table_args__ = (CheckConstraint("status IN ('pending','accepted','rejected')", name='proposal_status'),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('business_tasks.id', ondelete='CASCADE'), index=True)
    team_name: Mapped[str] = mapped_column(String(200))
    solution_idea: Mapped[str] = mapped_column(Text)
    plan: Mapped[str] = mapped_column(Text)
    estimated_time: Mapped[str] = mapped_column(String(200))
    prototype_url: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    pilot_document: Mapped[dict | None] = mapped_column(JSON)
    pilot_source_version: Mapped[str | None] = mapped_column(String(64))
    pilot_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
