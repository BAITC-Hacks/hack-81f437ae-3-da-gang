"""Task cards and team proposals."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def timestamps():
    return [sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())]


def upgrade():
    fields = ['title', 'topic', 'context', 'need', 'users', 'data_and_materials', 'constraints', 'expected_result', 'success_criteria', 'contact', 'interaction_format']
    op.create_table('business_tasks', sa.Column('id', sa.Uuid(), primary_key=True),
        *[sa.Column(name, sa.Text(), nullable=True) for name in fields],
        sa.Column('status', sa.String(20), nullable=False), sa.Column('readiness_score', sa.Integer(), nullable=False),
        *timestamps(), sa.CheckConstraint("status IN ('draft','confirmed','published')", name='task_status'),
        sa.CheckConstraint('readiness_score BETWEEN 0 AND 100', name='score_range'))
    for name in ['topic', 'status', 'readiness_score']:
        op.create_index(f'ix_business_tasks_{name}', 'business_tasks', [name])
    op.create_table('team_proposals', sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('task_id', sa.Uuid(), sa.ForeignKey('business_tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('team_name', sa.String(200), nullable=False), sa.Column('solution_idea', sa.Text(), nullable=False),
        sa.Column('plan', sa.Text(), nullable=False), sa.Column('estimated_time', sa.String(200), nullable=False),
        sa.Column('prototype_url', sa.Text(), nullable=True), sa.Column('status', sa.String(20), nullable=False),
        *timestamps(), sa.CheckConstraint("status IN ('pending','accepted','rejected')", name='proposal_status'))
    op.create_index('ix_team_proposals_task_id', 'team_proposals', ['task_id'])


def downgrade():
    op.drop_table('team_proposals')
    op.drop_table('business_tasks')
