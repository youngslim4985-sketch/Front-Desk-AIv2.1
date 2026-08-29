SHELL := /bin/bash

DATABASE_URL ?= postgresql://research:research@localhost:5432/research

export DATABASE_URL

.PHONY: help
help:
	@echo "PostgreSQL Internals Research"
	@echo ""
	@echo "Environment:"
	@echo "  make up             Start PostgreSQL"
	@echo "  make down           Stop PostgreSQL"
	@echo "  make reset          Destroy experimental database"
	@echo ""
	@echo "Validation:"
	@echo "  make check          Check environment"
	@echo "  make test           Run repository tests"
	@echo ""
	@echo "Diagnostics:"
	@echo "  make diagnostics    Run all diagnostics"
	@echo "  make slru           Capture SLRU statistics"
	@echo "  make waits          Capture wait events"
	@echo "  make replication    Check replication"
	@echo ""
	@echo "Experiments:"
	@echo "  make baseline"
	@echo "  make subxact"
	@echo "  make multixact"
	@echo ""
	@echo "Safety:"
	@echo "  make safety         Verify experiment safety gate"

.PHONY: up
up:
	docker compose up -d

.PHONY: down
down:
	docker compose down

.PHONY: reset
reset:
	docker compose down -v

.PHONY: check
check:
	./scripts/check_environment.sh

.PHONY: safety
safety:
	ALLOW_EXPERIMENTS=YES_I_AM_USING_DEDICATED_INFRASTRUCTURE \
		./tests/test_experiment_safety.sh

.PHONY: test
test:
	./tests/test_structure.sh
	./tests/test_sql_syntax.sh

.PHONY: diagnostics
diagnostics:
	./scripts/run_diagnostics.sh

.PHONY: slru
slru:
	./scripts/capture_slru.sh

.PHONY: waits
waits:
	./scripts/capture_waits.sh

.PHONY: replication
replication:
	./scripts/collect_replication.sh

.PHONY: version
version:
	./scripts/record_version.sh

.PHONY: baseline
baseline:
	./scripts/run_experiment.sh 00-baseline.sql

.PHONY: subxact
subxact:
	./scripts/run_experiment.sh 01-subxact-overflow.sql

.PHONY: multixact
multixact:
	./scripts/run_experiment.sh 03-multixact-pressure.sql

.PHONY: schema
schema:
	psql "$(DATABASE_URL)" \
		-v ON_ERROR_STOP=1 \
		-f sql/schema/results.sql

.PHONY: db
db: up
	@echo "Waiting for PostgreSQL..."
	@until pg_isready -d "$(DATABASE_URL)" >/dev/null 2>&1; do sleep 1; done
	@echo "PostgreSQL is ready."
