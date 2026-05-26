.PHONY: setup up down logs ps restart clean backend-shell frontend-shell psql redis-cli

setup:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example — edit it before running 'make up'."; else echo ".env already exists."; fi

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

restart:
	docker compose restart

clean:
	docker compose down -v

backend-shell:
	docker compose exec backend bash

frontend-shell:
	docker compose exec frontend sh

psql:
	docker compose exec postgres psql -U $${POSTGRES_USER:-yuno} -d $${POSTGRES_DB:-yuno}

redis-cli:
	docker compose exec redis redis-cli
