FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home --uid 1000 ciel
USER ciel

CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--no-access-log"]
