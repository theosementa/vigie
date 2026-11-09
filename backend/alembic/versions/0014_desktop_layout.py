"""account preference: users.desktop_layout (list | grid)

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-09 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "desktop_layout", sa.String(10), nullable=False, server_default=sa.text("'grid'")
        ),
    )
    op.create_check_constraint(
        "ck_users_desktop_layout", "users", "desktop_layout IN ('list', 'grid')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_desktop_layout", "users", type_="check")
    op.drop_column("users", "desktop_layout")
