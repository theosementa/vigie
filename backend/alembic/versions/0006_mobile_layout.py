"""account preference: users.mobile_layout (list | grid)

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-08 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("mobile_layout", sa.String(10), nullable=False, server_default=sa.text("'list'")),
    )
    op.create_check_constraint(
        "ck_users_mobile_layout", "users", "mobile_layout IN ('list', 'grid')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_mobile_layout", "users", type_="check")
    op.drop_column("users", "mobile_layout")
