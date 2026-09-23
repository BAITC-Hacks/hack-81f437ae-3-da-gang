"""Store a human-reviewed pilot document for an accepted proposal."""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('team_proposals', sa.Column('pilot_document', sa.JSON(), nullable=True))
    op.add_column('team_proposals', sa.Column('pilot_source_version', sa.String(64), nullable=True))
    op.add_column('team_proposals', sa.Column('pilot_confirmed', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('team_proposals', 'pilot_confirmed')
    op.drop_column('team_proposals', 'pilot_source_version')
    op.drop_column('team_proposals', 'pilot_document')
