SHELL := /bin/bash

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BACKEND_DIR := $(ROOT_DIR)/backend
FRONTEND_DIR := $(ROOT_DIR)/frontend

POSTGRES_CONTAINER ?= naija-pulse-postgres
POSTGRES_IMAGE ?= postgres:16-alpine
POSTGRES_PORT ?= 54329
POSTGRES_USER ?= postgres
POSTGRES_PASSWORD ?= postgres
POSTGRES_DB ?= naija_pulse

BACKEND_PORT ?= 8787
DATABASE_URL ?= postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@127.0.0.1:$(POSTGRES_PORT)/$(POSTGRES_DB)

.PHONY: help postgres-up postgres-down postgres-logs api frontend dev

help:
	@printf "Naija Pulse development targets\n\n"
	@printf "  make api           Start the API and its local Postgres dependency\n"
	@printf "  make frontend      Start the frontend dev server\n"
	@printf "  make dev           Start API + frontend together\n"
	@printf "  make postgres-up   Start the local Postgres container only\n"
	@printf "  make postgres-down Stop the local Postgres container\n"
	@printf "  make postgres-logs Tail the local Postgres container logs\n\n"
	@printf "Overrides:\n"
	@printf "  DATABASE_URL=%s\n" "$(DATABASE_URL)"
	@printf "  POSTGRES_PORT=%s\n" "$(POSTGRES_PORT)"

postgres-up:
	@command -v docker >/dev/null 2>&1 || { \
		echo "docker is required for make postgres-up/api/dev"; \
		exit 1; \
	}
	@if docker ps --format '{{.Names}}' | grep -qx '$(POSTGRES_CONTAINER)'; then \
		echo "Postgres container $(POSTGRES_CONTAINER) is already running."; \
	elif docker ps -a --format '{{.Names}}' | grep -qx '$(POSTGRES_CONTAINER)'; then \
		echo "Starting existing Postgres container $(POSTGRES_CONTAINER)..."; \
		docker start $(POSTGRES_CONTAINER) >/dev/null; \
	else \
		echo "Creating Postgres container $(POSTGRES_CONTAINER) on port $(POSTGRES_PORT)..."; \
		docker run --name $(POSTGRES_CONTAINER) \
			-e POSTGRES_USER=$(POSTGRES_USER) \
			-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
			-e POSTGRES_DB=$(POSTGRES_DB) \
			-p $(POSTGRES_PORT):5432 \
			-d $(POSTGRES_IMAGE) >/dev/null; \
	fi
	@until docker exec $(POSTGRES_CONTAINER) pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do \
		printf "Waiting for Postgres to become ready...\n"; \
		sleep 1; \
	done
	@printf "Postgres ready at %s\n" "$(DATABASE_URL)"

postgres-down:
	@command -v docker >/dev/null 2>&1 || { \
		echo "docker is required for make postgres-down"; \
		exit 1; \
	}
	@if docker ps --format '{{.Names}}' | grep -qx '$(POSTGRES_CONTAINER)'; then \
		docker stop $(POSTGRES_CONTAINER) >/dev/null; \
		echo "Stopped $(POSTGRES_CONTAINER)."; \
	else \
		echo "Postgres container $(POSTGRES_CONTAINER) is not running."; \
	fi

postgres-logs:
	@command -v docker >/dev/null 2>&1 || { \
		echo "docker is required for make postgres-logs"; \
		exit 1; \
	}
	@docker logs -f $(POSTGRES_CONTAINER)

api: postgres-up
	@cd $(BACKEND_DIR) && DATABASE_URL='$(DATABASE_URL)' PORT='$(BACKEND_PORT)' npm run dev

frontend:
	@cd $(FRONTEND_DIR) && npm run dev

dev: postgres-up
	@trap 'kill 0' EXIT INT TERM; \
		(cd $(BACKEND_DIR) && DATABASE_URL='$(DATABASE_URL)' PORT='$(BACKEND_PORT)' npm run dev) & \
		(cd $(FRONTEND_DIR) && npm run dev) & \
		wait
