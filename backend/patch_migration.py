filepath = "alembic/versions/95a5fa977de9_add_job_alerts_enabled.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "sa.Column('job_alerts_enabled', sa.Boolean(), nullable=False)",
    "sa.Column('job_alerts_enabled', sa.Boolean(), server_default='true', nullable=False)"
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched migration")
