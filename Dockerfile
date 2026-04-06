# IntelliStake Backend — Production Dockerfile
# Fixed: was pointing to dead engine.api.app; now uses chatbot_api.py
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc g++ git curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code
COPY engine/ ./engine/
COPY unified_data/ ./unified_data/
COPY models/ ./models/

# Create cache directories
RUN mkdir -p engine/cache

# Environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV FLASK_APP=engine.chatbot_api:app
ENV FLASK_ENV=production

EXPOSE 5500

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:5500/api/status || exit 1

# Run with gunicorn in production; fall back to flask dev server
CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:5500", "--workers", "2", "--timeout", "120", "engine.chatbot_api:app"]
