"""cutting line range_m

Revision ID: 0006_cutting_line_range
Revises: 0005_cutting_lines
Create Date: 2026-05-16
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_cutting_line_range"
down_revision: str | None = "0005_cutting_lines"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cutting_lines",
        sa.Column("range_m", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("cutting_lines", "range_m")
