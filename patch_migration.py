import sys

filepath = "backend/alembic/versions/3271ce8fd9d7_add_availability_and_shift_booking_.py"
with open(filepath, "r") as f:
    content = f.read()

# Make sure postgresql dialect is imported
if "from sqlalchemy.dialects import postgresql" not in content:
    content = content.replace("import sqlalchemy as sa", "import sqlalchemy as sa\nfrom sqlalchemy.dialects import postgresql")

# availabilitystatus already exists
content = content.replace(
    "sa.Enum('AVAILABLE', 'BUSY', 'UNAVAILABLE', name='availabilitystatus')",
    "postgresql.ENUM('AVAILABLE', 'BUSY', 'UNAVAILABLE', name='availabilitystatus', create_type=False)"
)

# salarytype already exists
content = content.replace(
    "sa.Enum('HOURLY', 'DAILY', 'MONTHLY', 'PROJECT', 'FIXED', name='salarytype')",
    "postgresql.ENUM('HOURLY', 'DAILY', 'MONTHLY', 'PROJECT', 'FIXED', name='salarytype', create_type=False)"
)

# bookingstatus is new, let it be created automatically by SQLAlchemy, or explicitly
content = content.replace(
    "sa.Enum('PENDING', 'CONFIRMED', 'DECLINED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'COMPLETED', name='bookingstatus')",
    "postgresql.ENUM('PENDING', 'CONFIRMED', 'DECLINED', 'RESCHEDULE_REQUESTED', 'CANCELLED', 'COMPLETED', name='bookingstatus', create_type=True)"
)

# In downgrade, drop bookingstatus ENUM
downgrade_patch = '''
    op.drop_table('worker_availability')
    op.execute("DROP TYPE bookingstatus")
    # ### end Alembic commands ###
'''
content = content.replace(
    "op.drop_table('worker_availability')\n    # ### end Alembic commands ###",
    downgrade_patch
)

with open(filepath, "w") as f:
    f.write(content)

print("Migration patched successfully.")
