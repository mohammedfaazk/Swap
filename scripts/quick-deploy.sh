#!/bin/bash

# Quick deployment script for StellarBridge Fusion+
# Run this after setting up your environment variables

set -e

echo "🚀 StellarBridge Fusion+ Quick Deploy Script"
echo "=============================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please copy .env.example to .env and configure it."
    exit 1
fi

# Check if contracts .env exists
if [ ! -f contracts/ethereum/.env ]; then
    echo "❌ contracts/ethereum/.env file not found! Please configure it."
    exit 1
fi

echo "✅ Environment files found"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Start databases
echo "🗄️  Starting databases..."
docker-compose up postgres redis -d

# Wait for databases to be ready
echo "⏳ Waiting for databases to start..."
sleep 10

# Setup database
echo "🔧 Setting up database..."
cd relayer
pnpm prisma migrate dev --name init
pnpm prisma generate
cd ..

# Compile contracts
echo "🔨 Compiling smart contracts..."
cd contracts/ethereum
pnpm compile
cd ../..

# Build application
echo "🏗️  Building application..."
pnpm build

echo ""
echo "✅ Setup complete! You can now:"
echo ""
echo "1. Deploy contracts:"
echo "   cd contracts/ethereum"
echo "   pnpm deploy:sepolia"
echo ""
echo "2. Start development server:"
echo "   pnpm dev"
echo ""
echo "3. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - API: http://localhost:3001"
echo "   - Health: http://localhost:3001/api/status/health"
echo ""
echo "🚨 Remember to:"
echo "   - Add your private keys to .env files"
echo "   - Get testnet tokens from faucets"
echo "   - Update contract addresses after deployment"
echo ""
echo "🎉 Ready for demo!"