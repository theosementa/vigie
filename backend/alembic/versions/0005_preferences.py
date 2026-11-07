"""account preferences: users.locale and users.theme

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-07 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("locale", sa.String(10), nullable=False, server_default=sa.text("'auto'")),
    )
    op.add_column(
        "users",
        sa.Column("theme", sa.String(10), nullable=False, server_default=sa.text("'system'")),
    )
    op.create_check_constraint("ck_users_locale", "users", "locale IN ('auto', 'en', 'fr')")
    op.create_check_constraint("ck_users_theme", "users", "theme IN ('system', 'dark', 'light')")


def downgrade() -> None:
    op.drop_constraint("ck_users_theme", "users", type_="check")
    op.drop_constraint("ck_users_locale", "users", type_="check")
    op.drop_column("users", "theme")
    op.drop_column("users", "locale")
