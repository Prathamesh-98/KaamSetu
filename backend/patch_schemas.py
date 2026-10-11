filepath = "app/schemas/schemas.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'preferred_work_types: Optional[List[str]] = None',
    'preferred_work_types: Optional[List[str]] = None\n    job_alerts_enabled: Optional[bool] = None'
)

content = content.replace(
    'total_ratings: int',
    'total_ratings: int\n    job_alerts_enabled: bool'
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched schemas.py")
