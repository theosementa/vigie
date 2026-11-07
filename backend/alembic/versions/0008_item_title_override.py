"""per-user item title: items.title_override

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-09 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("items", sa.Column("title_override", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("items", "title_override")
