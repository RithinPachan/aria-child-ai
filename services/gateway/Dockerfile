# syntax=docker/dockerfile:1.7
# ARIA Gateway — immutable, non-root Cloud Run image.
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build
COPY pyproject.toml ./
RUN python -m pip install --upgrade pip && \
    python -m pip wheel --wheel-dir /wheels .

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    HOME=/home/aria

RUN groupadd --system --gid 10001 aria && \
    useradd --system --uid 10001 --gid aria --create-home --home-dir /home/aria aria

WORKDIR /app
COPY --from=builder /wheels /wheels
RUN python -m pip install --no-cache-dir /wheels/* && rm -rf /wheels
COPY --chown=aria:aria src ./src

USER 10001:10001
EXPOSE 8080

# Cloud Run owns health probing. A single async worker is required for WebSocket affinity.
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
