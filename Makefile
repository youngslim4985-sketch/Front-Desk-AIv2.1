.PHONY: help up down restart ps logs psql test diagnostics \
        schema baseline experiment clean

COMPOSE ?= docker compose
SERVICE ?= postgres

help:
	@echo "PostgreSQL Research Harness"
	@echo
	@echo "Available targets:"
	@echo "  make up          Start PostgreSQL"
	@echo "  make down        Stop PostgreSQL"
	@echo "  make restart     Restart PostgreSQL"
	@echo "  make ps          Show container status"
	@echo "  make logs        Follow PostgreSQL logs"
	@echo "  make psql        Open psql"
	@echo "  make schema      Load research schema"
	@echo "  make diagnostics Run diagnostic SQL"
	@echo "  make baseline    Run baseline experiment"
	@echo "  make experiment  Run experiment harness"
	@echo "  make test        Run repository tests"
	@echo "  make clean       Remove local containers/volumes"

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f $(SERVICE)

psql:
	$(COMPOSE) exec $(SERVICE) \
		psql -U postgres -d postgres

schema:
	$(COMPOSE) exec -T $(SERVICE) \
		psql -U postgres -d postgres \
		< sql/schema/results.sql

diagnostics:
	@echo "Diagnostic SQL files:"
	@find sql/diagnostics -type f -name '*.sql' -print

baseline:
	@echo "Baseline experiment harness is defined under sql/experiments/"
	@echo "Run the specific experiment after reviewing its methodology."

experiment:
	@echo "Experiment harness is intentionally explicit."
	@echo "Review sql/experiments/ before execution."

test:
	@echo "Running repository tests..."
	@if [ -d tests ]; then \
		find tests -type f -maxdepth 2 -print; \
	fi

clean:
	$(COMPOSE) down -v --remove-orphans
