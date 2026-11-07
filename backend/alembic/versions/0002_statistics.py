"""statistics: user timezone, item events journal, seen_at index

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-05 14:10:27.617191
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "timezone", sa.String(length=64), server_default=sa.text("'UTC'"), nullable=False
        ),
    )
    op.create_index("ix_items_user_seen_at", "items", ["user_id", "seen_at"], unique=False)

    op.create_table(
        "item_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("other_user_id", sa.Uuid(), nullable=True),
        sa.Column("was_seen", sa.Boolean(), nullable=True),
        sa.CheckConstraint(
            "kind IN ('added', 'seen', 'unseen', 'deleted', 'shared')", name="ck_item_events_kind"
        ),
        sa.ForeignKeyConstraint(["other_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resource_id"], ["resources.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_item_events_user_kind_occurred",
        "item_events",
        ["user_id", "kind", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_item_events_user_occurred", "item_events", ["user_id", "occurred_at"], unique=False
    )

    # Backfill the journal from the current state of the items.
    # `added`: one per item (other_user_id = sharer for received items).
    op.execute(
        """
        INSERT INTO item_events (id, user_id, item_id, resource_id, kind, occurred_at, other_user_id)
        SELECT gen_random_uuid(), user_id, id, resource_id, 'added', created_at, shared_by_user_id
        FROM items
        """
    )
    # `seen`: one per item that is currently seen.
    op.execute(
        """
        INSERT INTO item_events (id, user_id, item_id, resource_id, kind, occurred_at)
        SELECT gen_random_uuid(), user_id, id, resource_id, 'seen', seen_at
        FROM items
        WHERE seen_at IS NOT NULL
        """
    )
    # `shared`: for the sender of every received item (still existing sender account only).
    # item_id points to the sender's own item for that resource when it still exists,
    # otherwise to the recipient's item.
    op.execute(
        """
        INSERT INTO item_events (id, user_id, item_id, resource_id, kind, occurred_at, other_user_id)
        SELECT gen_random_uuid(), i.shared_by_user_id,
               COALESCE(
                   (SELECT s.id FROM items s
                    WHERE s.user_id = i.shared_by_user_id AND s.resource_id = i.resource_id),
                   i.id
               ),
               i.resource_id, 'shared', i.created_at, i.user_id
        FROM items i
        WHERE i.shared_by_user_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_item_events_user_occurred", table_name="item_events")
    op.drop_index("ix_item_events_user_kind_occurred", table_name="item_events")
    op.drop_table("item_events")
    op.drop_index("ix_items_user_seen_at", table_name="items")
    op.drop_column("users", "timezone")
