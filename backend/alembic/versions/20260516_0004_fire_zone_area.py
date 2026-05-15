"""fire zone area_m2

Revision ID: 0004_fire_zone_area
Revises: 0003_water_reserves
Create Date: 2026-05-16
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_fire_zone_area"
down_revision: str | None = "0003_water_reserves"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fire_zones",
        sa.Column("area_m2", sa.Float, nullable=False, server_default="0"),
    )
    op.execute("UPDATE fire_zones SET area_m2 = abs(ST_Area(polygon))")
    op.alter_column("fire_zones", "area_m2", server_default=None)


def downgrade() -> None:
    op.drop_column("fire_zones", "area_m2")
