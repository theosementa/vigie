"""watch queue: items.queue_position

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-05 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("items", sa.Column("queue_position", sa.Integer(), nullable=True))
    op.create_index(
        "ix_items_user_queue_position",
        "items",
        ["user_id", "queue_position"],
        unique=False,
        postgresql_where=sa.text("queue_position IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_items_user_queue_position",
        table_name="items",
        postgresql_where=sa.text("queue_position IS NOT NULL"),
    )
    op.drop_column("items", "queue_position")
