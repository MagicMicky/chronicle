# Chronicle Development Commands
# Use `make -C /path/to/chronicle <target>` from any directory
SHELL := /bin/bash
export PATH := $(HOME)/.nvm/versions/node/$(shell ls $(HOME)/.nvm/versions/node/ | tail -1)/bin:$(HOME)/.bun/bin:$(PATH)

# Detect MCP binary name for current platform
ARCH := $(shell uname -m | sed 's/arm64/aarch64/')
MCP_BINARY := $(CURDIR)/app/src-tauri/binaries/chronicle-mcp-$(ARCH)-apple-darwin

# Auto-build MCP binary if missing (used by targets that invoke cargo)
define ensure-mcp-binary
@if [ ! -f "$(MCP_BINARY)" ]; then \
	echo "MCP binary missing, building..."; \
	$(MAKE) bundle-mcp; \
fi
endef

# Development
.PHONY: dev dev-app dev-mcp

dev-app:
	$(ensure-mcp-binary)
	cd app && npm run tauri dev

dev-mcp:
	cd mcp-server && bun run dev

dev: dev-app

# Type checking
.PHONY: check check-svelte check-rust check-mcp

check-svelte:
	cd app && npm run check

check-rust:
	$(ensure-mcp-binary)
	cd app/src-tauri && cargo check

check-mcp:
	cd mcp-server && npx tsc --noEmit

check: check-svelte check-rust check-mcp

# Linting
.PHONY: lint lint-rust

lint-rust:
	$(ensure-mcp-binary)
	cd app/src-tauri && cargo clippy

lint: lint-rust

# Testing
.PHONY: test test-rust test-mcp

test-rust:
	$(ensure-mcp-binary)
	cd app/src-tauri && cargo test

test-mcp:
	cd mcp-server && bun test

test: test-rust test-mcp

# Building
.PHONY: build build-app build-mcp bundle-mcp

build-app: bundle-mcp
	cd app && npm run tauri build

build-mcp:
	cd mcp-server && bun build src/index.ts --outdir dist

# Compile MCP binary for current platform and copy to Tauri sidecar location
bundle-mcp:
	mkdir -p $(CURDIR)/app/src-tauri/binaries
	@ARCH=$$(uname -m); \
	if [ "$$ARCH" = "arm64" ]; then \
		echo "Compiling MCP binary for macOS ARM64..."; \
		cd $(CURDIR)/mcp-server && bun run compile:mac-arm; \
		cp $(CURDIR)/mcp-server/dist/chronicle-mcp-aarch64-apple-darwin $(CURDIR)/app/src-tauri/binaries/; \
	elif [ "$$ARCH" = "x86_64" ] && [ "$$(uname)" = "Darwin" ]; then \
		echo "Compiling MCP binary for macOS x64..."; \
		cd $(CURDIR)/mcp-server && bun run compile:mac-x64; \
		cp $(CURDIR)/mcp-server/dist/chronicle-mcp-x86_64-apple-darwin $(CURDIR)/app/src-tauri/binaries/; \
	elif [ "$$ARCH" = "x86_64" ]; then \
		echo "Compiling MCP binary for Linux x64..."; \
		cd $(CURDIR)/mcp-server && bun run compile:linux; \
		cp $(CURDIR)/mcp-server/dist/chronicle-mcp-x86_64-unknown-linux-gnu $(CURDIR)/app/src-tauri/binaries/; \
	else \
		echo "Unknown architecture: $$ARCH"; exit 1; \
	fi

build: bundle-mcp build-app build-mcp

# Dependencies
.PHONY: install install-app install-mcp

install-app:
	cd app && npm install

install-mcp:
	cd mcp-server && bun install

install: install-app install-mcp bundle-mcp

# Full verification (run before committing)
.PHONY: verify
verify: check lint test
