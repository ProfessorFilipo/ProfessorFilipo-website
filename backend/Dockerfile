# Same Python version used in local development (3.13), for consistency.
FROM python:3.13-slim

WORKDIR /app

# System libraries required by WeasyPrint (PDF rendering for the
# autoavaliação report) — Pango/HarfBuzz for text shaping, cairo for
# drawing, gdk-pixbuf for the embedded evidence images, fontconfig so the
# @font-face fonts bundled in app/assets/fonts resolve correctly.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libharfbuzz0b \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

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
