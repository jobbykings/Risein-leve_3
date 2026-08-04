# Soroban crowdfund contract — build, test and deployment workflow.
#
# Quick start:
#   make init        copy .env.example -> .env and fill it in
#   make deploy      build + deploy + initialize + update the TS client (one command)
#
# All targets:
#   make build       compile the contract wasm (adds the wasm target if missing)
#   make test        run the Rust test suite
#   make lint        cargo fmt --check + clippy -D warnings
#   make bindings    regenerate the TS client against a deployed contract (set CONTRACT_ID)
#   make deploy      full one-command deploy (build, deploy, initialize, bindings, client wiring)
#   make init        scaffold a local .env from .env.example

SHELL := /bin/bash

# Load local deploy config (.env) so make targets and deploy.sh share it.
# `make init` scaffolds .env from .env.example.
-include .env

WASM_PATH := target/wasm32-unknown-unknown/release/crowdfund.wasm
CLIENT_DIR := ../src/contracts/crowdfund-client
NETWORK := $(or $(STELLAR_NETWORK),testnet)

.PHONY: help init build test lint bindings deploy

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

init: ## Create .env from .env.example
	@test -f .env || cp .env.example .env
	@echo "Created .env — edit it with your deploy details (see .env.example comments)."

build: ## Compile the contract wasm
	@rustup target list --installed | grep -q wasm32-unknown-unknown \
		|| rustup target add wasm32-unknown-unknown
	cargo build --release --target wasm32-unknown-unknown

test: ## Run the contract test suite
	cargo test --workspace

lint: ## Check formatting and clippy
	cargo fmt --all --check
	cargo clippy --workspace --all-targets --all-features -- -D warnings

bindings: ## Regenerate the TS client against a deployed contract (CONTRACT_ID=...)
	@test -n "$(CONTRACT_ID)" || (echo "ERROR: set CONTRACT_ID=<deployed contract id> (or use 'make deploy')" >&2 && exit 1)
	stellar contract bindings typescript \
		--output-dir $(CLIENT_DIR) --overwrite \
		--contract-id $(CONTRACT_ID) --network $(NETWORK)
	@echo ""
	@echo "Client regenerated. Update networks.testnet.contractId in $(CLIENT_DIR)/src/index.ts"
	@echo "and restore the top-level re-export: printf 'export * from \"./src/index\";' > $(CLIENT_DIR)/index.ts"

deploy: ## Full one-command deploy + initialize + client wiring
	bash scripts/deploy.sh
