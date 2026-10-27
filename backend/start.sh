#!/bin/sh
set -e

echo "=== KaamSetu: Running database migrations ==="
python -m alembic upgrade head

echo "=== KaamSetu: Starting application server ==="
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
