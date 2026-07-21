FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
COPY app ./app
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN uv sync --frozen --no-dev \
  && chmod +x /docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=90s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4000/health')"

ENTRYPOINT ["/docker-entrypoint.sh"]
