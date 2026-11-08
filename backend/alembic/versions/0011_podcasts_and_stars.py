"""repository stars: resources.stars and resources.stars_fetched_at

The new "podcast" type needs no schema change (resources.type and items.type_override are free text).

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-08 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("resources", sa.Column("stars", sa.Integer(), nullable=True))
    op.add_column(
        "resources", sa.Column("stars_fetched_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("resources", "stars_fetched_at")
    op.drop_column("resources", "stars")
