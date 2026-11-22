#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
exec uvicorn app.main:app --port 8000
