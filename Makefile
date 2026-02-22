# Chronicle Development Commands
# Use `make -C /path/to/chronicle <target>` from any directory
SHELL := /bin/bash
export PATH := $(HOME)/.nvm/versions/node/$(shell ls $(HOME)/.nvm/versions/node/ | tail -1)/bin:$(HOME)/.bun/bin:$(PATH)

# Development
.PHONY: dev dev-app dev-mcp

dev-app:
	cd app && npm run tauri dev

dev-mcp:
	cd mcp-server && bun run dev

dev: dev-app

# Type checking
.PHONY: check check-svelte check-rust check-mcp

check-svelte:
	cd app && npm run check

check-rust:
	cd app/src-tauri && cargo check

check-mcp:
	cd mcp-server && npx tsc --noEmit

check: check-svelte check-rust check-mcp

# Linting
.PHONY: lint lint-rust

lint-rust:
	cd app/src-tauri && cargo clippy

lint: lint-rust

# Testing
.PHONY: test test-rust test-mcp

test-rust:
	cd app/src-tauri && cargo test

test-mcp:
	cd mcp-server && bun test

test: test-rust test-mcp

# Building
.PHONY: build build-app build-mcp

build-app:
	cd app && npm run tauri build

build-mcp:
	cd mcp-server && bun build src/index.ts --outdir dist

build: build-app build-mcp

# Dependencies
.PHONY: install install-app install-mcp

install-app:
	cd app && npm install

install-mcp:
	cd mcp-server && npm install

install: install-app install-mcp

# Full verification (run before committing)
.PHONY: verify
verify: check lint test
