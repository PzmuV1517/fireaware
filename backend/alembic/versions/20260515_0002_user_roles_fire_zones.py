"""user roles and fire zones

Revision ID: 0002_user_roles_fire_zones
Revises: 0001_initial
Create Date: 2026-05-15
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "0002_user_roles_fire_zones"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default=sa.text("'civilian'")))
    op.create_table(
        "fire_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("polygon", Geography(geometry_type="POLYGON", srid=4326), nullable=False),
        sa.Column("label", sa.String(200), nullable=True),
        sa.Column("color", sa.String(20), nullable=False, server_default=sa.text("'#C9532A'")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("CREATE INDEX ix_fire_zones_polygon ON fire_zones USING GIST (polygon)")

def downgrade() -> None:
    op.drop_table("fire_zones")
    op.drop_column("users", "role")
