"""contacts (private address book), share log, and the auto-create-contacts preference

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-08 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "owner_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("owner_user_id", "email", name="uq_contacts_owner_email"),
    )
    op.create_table(
        "share_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "sender_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recipient_email", sa.String(320), nullable=False),
        sa.Column(
            "recipient_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resource_id", sa.Uuid(), sa.ForeignKey("resources.id"), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("shared_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_share_log_sender_recipient_at",
        "share_log",
        ["sender_user_id", "recipient_email", "shared_at"],
    )
    op.create_index("ix_share_log_recipient_at", "share_log", ["recipient_user_id", "shared_at"])
    op.add_column(
        "users",
        sa.Column(
            "auto_create_contacts", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "auto_create_contacts")
    op.drop_index("ix_share_log_recipient_at", table_name="share_log")
    op.drop_index("ix_share_log_sender_recipient_at", table_name="share_log")
    op.drop_table("share_log")
    op.drop_table("contacts")
