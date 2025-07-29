#!/bin/bash
set -e

echo "Running ESLint and Prettier for code quality..."

pnpm eslint --fix "relayer/src/**/*.ts" "frontend/src/**/*.tsx" "contracts/ethereum/contracts/**/*.sol" || true
pnpm prettier --write "relayer/src/**/*.ts" "frontend/src/**/*.tsx" "contracts/ethereum/contracts/**/*.sol"

echo "Lint and format complete."
