# StellarBridge Fusion+ - One-Command Deployment
.PHONY: all install build test deploy demo clean

# Colors for pretty output
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
RESET := \033[0m

# Default target
all: install build test

# Installation
install:
	@echo "$(BLUE)🚀 Installing StellarBridge Fusion+ dependencies...$(RESET)"
	pnpm install
	cd contracts/stellar && cargo build
	@echo "$(GREEN)✅ Installation complete!$(RESET)"

# Build all components
build:
	@echo "$(BLUE)🔨 Building all components...$(RESET)"
	turbo run build
	@echo "$(GREEN)✅ Build complete!$(RESET)"

# Run tests
test:
	@echo "$(BLUE)🧪 Running comprehensive test suite...$(RESET)"
	turbo run test
	turbo run test:e2e
	@echo "$(GREEN)✅ All tests passed!$(RESET)"

# Deploy to testnet
deploy-testnet:
	@echo "$(BLUE)🚀 Deploying to testnet...$(RESET)"
	cd contracts/ethereum && pnpm run deploy:sepolia
	cd contracts/stellar && pnpm run deploy:testnet
	cd relayer && docker-compose up -d --build
	@echo "$(GREEN)✅ Testnet deployment complete!$(RESET)"

# Deploy to mainnet (production)
deploy-mainnet:
	@echo "$(RED)⚠️  MAINNET DEPLOYMENT - ARE YOU SURE? (Press Enter to continue)$(RESET)"
	@read
	@echo "$(BLUE)🚀 Deploying to mainnet...$(RESET)"
	cd contracts/ethereum && pnpm run deploy:mainnet
	cd contracts/stellar && pnpm run deploy:mainnet
	@echo "$(GREEN)✅ Mainnet deployment complete!$(RESET)"

# Setup demo environment
demo-setup:
	@echo "$(BLUE)🎭 Setting up demo environment...$(RESET)"
	docker-compose -f docker-compose.demo.yml up -d
	cd contracts/ethereum && pnpm run setup-demo
	cd contracts/stellar && pnpm run setup-demo
	@echo "$(GREEN)✅ Demo environment ready!$(RESET)"

# Run live demo
demo-run:
	@echo "$(YELLOW)🎪 Starting live demo...$(RESET)"
	cd frontend && pnpm run demo
	@echo "$(GREEN)🏆 Demo complete - judges will be amazed!$(RESET)"

# Performance benchmarks
benchmark:
	@echo "$(BLUE)📊 Running performance benchmarks...$(RESET)"
	turbo run benchmark
	@echo "$(GREEN)✅ Benchmarks complete!$(RESET)"

# Clean everything
clean:
	@echo "$(BLUE)🧹 Cleaning build artifacts...$(RESET)"
	turbo run clean
	docker-compose down -v
	@echo "$(GREEN)✅ Cleanup complete!$(RESET)"

# Health check
health-check:
	@echo "$(BLUE)🏥 Checking system health...$(RESET)"
	./deployment/scripts/health-check.sh
	@echo "$(GREEN)✅ System is healthy!$(RESET)"

# Quick demo for judges
judge-demo: demo-setup
	@echo "$(YELLOW)👨‍⚖️ JUDGES DEMO STARTING...$(RESET)"
	@echo "$(GREEN)1. Opening swap interface...$(RESET)"
	open http://localhost:3000
	@echo "$(GREEN)2. Starting resolver dashboard...$(RESET)"
	open http://localhost:3000/resolvers
	@echo "$(GREEN)3. Opening analytics...$(RESET)"
	open http://localhost:3000/analytics
	@echo "$(YELLOW)🏆 JUDGES: Prepare to be amazed!$(RESET)"
