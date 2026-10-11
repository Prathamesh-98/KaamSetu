with open("app/models/models.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'total_ratings = Column(Integer, default=0, nullable=False)',
    'total_ratings = Column(Integer, default=0, nullable=False)\n    job_alerts_enabled = Column(Boolean, default=True, nullable=False)'
)

with open("app/models/models.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Added job_alerts_enabled to WorkerProfile")
