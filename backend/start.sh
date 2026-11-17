#!/bin/sh
set -e

echo "=== KaamSetu: Running database migrations ==="
python -m alembic upgrade head

if [ "$RUN_SEED" = "true" ] || [ "$RUN_SEED" = "True" ]; then
    echo "=== KaamSetu: Seeding initial categories and skills ==="
    python -m app.db.seed || echo "Seeding completed or already initialized."
fi

echo "=== KaamSetu: Starting application server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
