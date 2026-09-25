FROM python:3.12-slim

WORKDIR /app

# Stdlib-only app; requirements.txt is empty (informational)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt || true

COPY . .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["python", "server.py"]
