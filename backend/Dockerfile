# Same Python version used in local development (3.13), for consistency.
FROM python:3.13-slim

WORKDIR /app

# Install dependencies first (better layer caching — only reinstalls when
# requirements.txt actually changes, not on every code edit)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY app/ ./app/

# Cloud Run injects the PORT environment variable; default to 8080 locally.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
