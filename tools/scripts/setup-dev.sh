#!/bin/bash
set -e

echo "Setting up development environment for StellarBridge Fusion+..."

echo "Installing global dependencies..."
npm install -g pnpm ts-node

echo "Installing root dependencies..."
pnpm install

echo "Generating Prisma client..."
cd relayer
pnpm prisma generate
cd ..

echo "Building contracts..."
cd contracts/ethereum
pnpm compile
cd ../..

echo "Setup complete! You can now run 'pnpm dev' to start development."
