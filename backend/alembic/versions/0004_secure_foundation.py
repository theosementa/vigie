"""secure foundation: names + roles + token_version, instance settings, invitations,
password resets, resources.url_hash

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-06 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- users: first/last name, role, token_version -------------------------------------
    op.add_column("users", sa.Column("first_name", sa.String(50), nullable=True))
    op.add_column(
        "users", sa.Column("last_name", sa.String(50), nullable=False, server_default=sa.text("''"))
    )
    op.add_column(
        "users", sa.Column("role", sa.String(20), nullable=False, server_default=sa.text("'user'"))
    )
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    # display_name is split on its first space; the last name stays empty for a single word
    op.execute(
        """
        UPDATE users SET
            first_name = left(COALESCE(
                NULLIF(split_part(btrim(display_name), ' ', 1), ''),
                split_part(email, '@', 1)
            ), 50),
            last_name = left(btrim(substr(
                btrim(display_name), length(split_part(btrim(display_name), ' ', 1)) + 1
            )), 50)
        """
    )
    op.alter_column("users", "first_name", nullable=False)
    op.drop_column("users", "display_name")
    op.create_check_constraint("ck_users_role", "users", "role IN ('admin', 'user')")
    # an existing instance has no admin yet: its oldest account becomes one
    op.execute(
        "UPDATE users SET role = 'admin' WHERE id = "
        "(SELECT id FROM users ORDER BY created_at, id LIMIT 1)"
    )

    # --- instance settings (single row, seeded lazily from REGISTRATION) ---------------------
    op.create_table(
        "instance_settings",
        sa.Column("id", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("registration_mode", sa.String(10), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_instance_settings_single_row"),
        sa.CheckConstraint(
            "registration_mode IN ('invite', 'open', 'closed')", name="ck_instance_settings_mode"
        ),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- invitations ---------------------------------------------------------------------
    op.create_table(
        "invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # --- password resets -------------------------------------------------------------------
    op.create_table(
        "password_resets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )

    # --- resources.url_hash: unique key instead of a btree on the (unbounded) url ----------
    op.add_column("resources", sa.Column("url_hash", sa.String(64), nullable=True))
    op.execute("UPDATE resources SET url_hash = encode(sha256(convert_to(url, 'UTF8')), 'hex')")
    op.alter_column("resources", "url_hash", nullable=False)
    op.create_unique_constraint("uq_resources_url_hash", "resources", ["url_hash"])
    op.drop_constraint("resources_url_key", "resources", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("resources_url_key", "resources", ["url"])
    op.drop_constraint("uq_resources_url_hash", "resources", type_="unique")
    op.drop_column("resources", "url_hash")

    op.drop_table("password_resets")
    op.drop_table("invitations")
    op.drop_table("instance_settings")

    op.add_column(
        "users", sa.Column("display_name", sa.String(100), nullable=False, server_default="")
    )
    op.execute("UPDATE users SET display_name = left(btrim(first_name || ' ' || last_name), 100)")
    op.alter_column("users", "display_name", server_default=None)
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "token_version")
    op.drop_column("users", "role")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
