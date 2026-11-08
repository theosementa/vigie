"""account preference: users.hidden_types replaces users.show_repos

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-08 14:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("hidden_types", ARRAY(sa.String(20)), nullable=False, server_default="{}"),
    )
    op.execute("UPDATE users SET hidden_types = ARRAY['repo'] WHERE NOT show_repos")
    op.drop_column("users", "show_repos")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("show_repos", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.execute("UPDATE users SET show_repos = false WHERE 'repo' = ANY(hidden_types)")
    op.drop_column("users", "hidden_types")
