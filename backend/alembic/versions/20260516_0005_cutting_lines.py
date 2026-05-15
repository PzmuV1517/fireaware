"""cutting lines

Revision ID: 0005_cutting_lines
Revises: 0004_fire_zone_area
Create Date: 2026-05-16
"""
from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0005_cutting_lines"
down_revision: str | None = "0004_fire_zone_area"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cutting_lines",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column(
            "path",
            geoalchemy2.types.Geography(geometry_type="LINESTRING", srid=4326),
            nullable=False,
        ),
        sa.Column("label", sa.String(200), nullable=True),
        sa.Column("length_m", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("cutting_lines")
