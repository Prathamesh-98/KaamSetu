"""add work completion and payment records

Revision ID: d50f32a0fb12
Revises: c49e21e9ea01
Create Date: 2026-10-25 00:53:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd50f32a0fb12'
down_revision: Union[str, Sequence[str], None] = 'c49e21e9ea01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types if not exists
    payment_method = postgresql.ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER', name='paymentmethod', create_type=True)
    payment_method.create(op.get_bind(), checkfirst=True)

    payment_status = postgresql.ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'PARTIALLY_PAID', 'DISPUTED', name='paymentstatus', create_type=True)
    payment_status.create(op.get_bind(), checkfirst=True)

    # Create work_completions table
    op.create_table(
        'work_completions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('shift_booking_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('shift_bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('actual_start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('hours_worked', sa.Numeric(5, 2), nullable=False),
        sa.Column('completion_notes', sa.Text(), nullable=True),
        sa.Column('completed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('actual_start_time < actual_end_time', name='chk_completion_times'),
        sa.CheckConstraint('hours_worked > 0 AND hours_worked <= 24', name='chk_completion_hours'),
        sa.UniqueConstraint('shift_booking_id', name='uq_work_completions_shift_booking_id')
    )

    # Create payment_records table
    op.create_table(
        'payment_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('work_completion_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('work_completions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shift_booking_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('shift_bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agreed_amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(10, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='INR', nullable=False),
        sa.Column('payment_method', postgresql.ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER', name='paymentmethod', create_type=False), nullable=False),
        sa.Column('payment_status', postgresql.ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'PARTIALLY_PAID', 'DISPUTED', name='paymentstatus', create_type=False), server_default='PENDING_CONFIRMATION', nullable=False),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('payment_reference', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('employer_recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('worker_confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dispute_reason', sa.Text(), nullable=True),
        sa.Column('disputed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('disputed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('dispute_history', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('agreed_amount >= 0', name='chk_payment_agreed_amount_non_negative'),
        sa.CheckConstraint('amount_paid >= 0', name='chk_payment_amount_paid_non_negative'),
        sa.CheckConstraint("currency = 'INR'", name='chk_payment_currency_inr'),
        sa.UniqueConstraint('work_completion_id', name='uq_payment_records_work_completion_id'),
        sa.UniqueConstraint('shift_booking_id', name='uq_payment_records_shift_booking_id')
    )
    op.create_index('ix_payment_records_payment_status', 'payment_records', ['payment_status'])

    # Create payment_installments table
    op.create_table(
        'payment_installments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('payment_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_records.id', ondelete='CASCADE'), nullable=False),
        sa.Column('installment_number', sa.Integer(), server_default='1', nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('payment_method', postgresql.ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER', name='paymentmethod', create_type=False), nullable=False),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('payment_reference', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('worker_confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_installment_amount_positive')
    )
    op.create_index('ix_payment_installments_payment_record_id', 'payment_installments', ['payment_record_id'])


def downgrade() -> None:
    op.drop_index('ix_payment_installments_payment_record_id', table_name='payment_installments')
    op.drop_table('payment_installments')

    op.drop_index('ix_payment_records_payment_status', table_name='payment_records')
    op.drop_table('payment_records')

    op.drop_table('work_completions')

    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentmethod")
