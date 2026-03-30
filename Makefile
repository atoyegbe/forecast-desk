SHELL := /bin/bash

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BACKEND_DIR := $(ROOT_DIR)/backend
FRONTEND_DIR := $(ROOT_DIR)/frontend
DOCKER_COMPOSE_FILE := $(ROOT_DIR)/compose.yml
DOCKER_COMPOSE := \
	POSTGRES_IMAGE='$(POSTGRES_IMAGE)' \
	POSTGRES_PORT='$(POSTGRES_PORT)' \
	POSTGRES_USER='$(POSTGRES_USER)' \
	POSTGRES_PASSWORD='$(POSTGRES_PASSWORD)' \
	POSTGRES_DB='$(POSTGRES_DB)' \
	REDIS_IMAGE='$(REDIS_IMAGE)' \
	REDIS_PORT='$(REDIS_PORT)' \
	docker compose -f $(DOCKER_COMPOSE_FILE)

POSTGRES_IMAGE ?= postgres:16-alpine
POSTGRES_PORT ?= 54329
POSTGRES_USER ?= postgres
POSTGRES_PASSWORD ?= postgres
POSTGRES_DB ?= naija_pulse

REDIS_IMAGE ?= redis:7-alpine
REDIS_PORT ?= 6379
CACHE_ENABLED ?= true

BACKEND_PORT ?= 8787
DATABASE_URL ?= postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@127.0.0.1:$(POSTGRES_PORT)/$(POSTGRES_DB)
REDIS_URL ?= redis://127.0.0.1:$(REDIS_PORT)

.PHONY: \
	help \
	check-docker \
	infra-up infra-down infra-logs \
	postgres-up postgres-down postgres-logs \
	redis-up redis-down redis-logs \
	api worker frontend dev

help:
	@printf "Quorum development targets\n\n"
	@printf "  make api           Start the API and local Postgres + Redis\n"
	@printf "  make worker        Start the worker and local Postgres + Redis\n"
	@printf "  make frontend      Start the frontend dev server\n"
	@printf "  make dev           Start API + worker + frontend together\n"
	@printf "  make infra-up      Start local Postgres + Redis with Docker Compose\n"
	@printf "  make infra-down    Stop local Postgres + Redis services\n"
	@printf "  make infra-logs    Tail local Postgres + Redis logs\n"
	@printf "  make postgres-up   Start local Postgres only\n"
	@printf "  make postgres-down Stop local Postgres only\n"
	@printf "  make postgres-logs Tail local Postgres logs\n"
	@printf "  make redis-up      Start local Redis only\n"
	@printf "  make redis-down    Stop local Redis only\n"
	@printf "  make redis-logs    Tail local Redis logs\n\n"
	@printf "Overrides:\n"
	@printf "  DATABASE_URL=%s\n" "$(DATABASE_URL)"
	@printf "  REDIS_URL=%s\n" "$(REDIS_URL)"
	@printf "  CACHE_ENABLED=%s\n" "$(CACHE_ENABLED)"
	@printf "  POSTGRES_PORT=%s\n" "$(POSTGRES_PORT)"
	@printf "  REDIS_PORT=%s\n" "$(REDIS_PORT)"

check-docker:
	@command -v docker >/dev/null 2>&1 || { \
		echo "docker is required for local infrastructure targets"; \
		exit 1; \
	}
	@docker compose version >/dev/null 2>&1 || { \
		echo "docker compose is required for local infrastructure targets"; \
		exit 1; \
	}

postgres-up: check-docker
	@$(DOCKER_COMPOSE) up -d postgres >/dev/null
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do \
		printf "Waiting for Postgres to become ready...\n"; \
		sleep 1; \
	done
	@printf "Postgres ready at %s\n" "$(DATABASE_URL)"

redis-up: check-docker
	@$(DOCKER_COMPOSE) up -d redis >/dev/null
	@until $(DOCKER_COMPOSE) exec -T redis redis-cli ping >/dev/null 2>&1; do \
		printf "Waiting for Redis to become ready...\n"; \
		sleep 1; \
	done
	@printf "Redis ready at %s\n" "$(REDIS_URL)"

infra-up: postgres-up redis-up

postgres-down: check-docker
	@$(DOCKER_COMPOSE) stop postgres >/dev/null 2>&1 || true
	@echo "Stopped Postgres service."

redis-down: check-docker
	@$(DOCKER_COMPOSE) stop redis >/dev/null 2>&1 || true
	@echo "Stopped Redis service."

infra-down: check-docker
	@$(DOCKER_COMPOSE) stop postgres redis >/dev/null 2>&1 || true
	@echo "Stopped Postgres and Redis services."

postgres-logs: check-docker
	@$(DOCKER_COMPOSE) logs -f postgres

redis-logs: check-docker
	@$(DOCKER_COMPOSE) logs -f redis

infra-logs: check-docker
	@$(DOCKER_COMPOSE) logs -f postgres redis

api: infra-up
	@cd $(BACKEND_DIR) && \
		DATABASE_URL='$(DATABASE_URL)' \
		REDIS_URL='$(REDIS_URL)' \
		CACHE_ENABLED='$(CACHE_ENABLED)' \
		PORT='$(BACKEND_PORT)' \
		npm run dev

worker: infra-up
	@cd $(BACKEND_DIR) && \
		DATABASE_URL='$(DATABASE_URL)' \
		REDIS_URL='$(REDIS_URL)' \
		CACHE_ENABLED='$(CACHE_ENABLED)' \
		npm run dev:worker

frontend:
	@cd $(FRONTEND_DIR) && npm run dev

dev: infra-up
	@trap 'kill 0' EXIT INT TERM; \
		(cd $(BACKEND_DIR) && \
			DATABASE_URL='$(DATABASE_URL)' \
			REDIS_URL='$(REDIS_URL)' \
			CACHE_ENABLED='$(CACHE_ENABLED)' \
			PORT='$(BACKEND_PORT)' \
			SMART_MONEY_SCHEDULER_ENABLED='false' \
			npm run dev) & \
		(cd $(BACKEND_DIR) && \
			DATABASE_URL='$(DATABASE_URL)' \
			REDIS_URL='$(REDIS_URL)' \
			CACHE_ENABLED='$(CACHE_ENABLED)' \
			npm run dev:worker) & \
		(cd $(FRONTEND_DIR) && npm run dev) & \
		wait
