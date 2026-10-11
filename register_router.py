with open("backend/app/main.py", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "from app.api.routes import auth, workers, employers, jobs, applications, admin, notifications, upload, chat, ratings",
    "from app.api.routes import auth, workers, employers, jobs, applications, admin, notifications, upload, chat, ratings, shifts"
)

content = content.replace(
    "app.include_router(applications.router, prefix=API_PREFIX)",
    "app.include_router(applications.router, prefix=API_PREFIX)\napp.include_router(shifts.router, prefix=API_PREFIX)"
)

with open("backend/app/main.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Router registered")
