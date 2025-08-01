# 🚀 StellarBridge Fusion+ Setup Guide

## 🚨 URGENT FIXES APPLIED

### Fixed Critical Issues:
1. ✅ **Hardhat Config**: Fixed gas limits (was 50, now 5M), gas prices (was 10, now 20 gwei)
2. ✅ **Security**: Removed exposed private keys and API keys from configs
3. ✅ **Network Setup**: Added proper testnet configurations
4. ✅ **Environment**: Created secure environment variable templates

## 📋 Prerequisites

### Required Software:
- **Node.js**: v18+ 
- **pnpm**: v8+ (`npm install -g pnpm`)
- **Docker**: Latest version
- **PostgreSQL**: v14+ (or use Docker)
- **Redis**: v7+ (or use Docker)

### Required Accounts & Keys:

#### 1. **Infura Account** (for Ethereum)
- Go to: https://infura.io
- Create account → Create project → Get API key
- Copy the Project ID (your Infura key)

#### 2. **Ethereum Wallet** (for testnet)
- Install MetaMask: https://metamask.io
- Create new wallet → **SAVE YOUR SEED PHRASE**
- Export private key (Account → Account Details → Export Private Key)
- Add Sepolia testnet to MetaMask

#### 3. **Stellar Wallet** (for testnet)
- Go to: https://laboratory.stellar.org/#account-creator?network=test
- Click "Create Account" → **SAVE THE SECRET KEY**
- Fund with testnet XLM: https://friendbot.stellar.org

#### 4. **Etherscan API** (for contract verification)
- Go to: https://etherscan.io/apis
- Create account → Get free API key

## 🔧 Setup Instructions

### Step 1: Clone & Install Dependencies

```bash
# Clone repository
git clone <repo-url>
cd Swap

# Install all dependencies
pnpm install

# Install contract dependencies
cd contracts/ethereum
pnpm install
cd ../..
```

### Step 2: Environment Configuration

#### Main .env file:
```bash
cp .env.example .env
```

Edit `.env` with your keys:
```env
# Ethereum Configuration
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY_HERE
ETHEREUM_PRIVATE_KEY=0xYOUR_ETHEREUM_PRIVATE_KEY_HERE

# Stellar Configuration  
STELLAR_SECRET_KEY=SYOUR_STELLAR_SECRET_KEY_HERE

# Security
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-chars

# Optional: Contract addresses (will be set after deployment)
HTLC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
STELLAR_CONTRACT_ID=YOUR_STELLAR_CONTRACT_ID
```

#### Ethereum contracts .env:
```bash
cd contracts/ethereum
cp .env.example .env
```

Edit `contracts/ethereum/.env`:
```env
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY_HERE
ETHEREUM_PRIVATE_KEY=0xYOUR_ETHEREUM_PRIVATE_KEY_HERE
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY_HERE
INFURA_KEY=YOUR_INFURA_KEY_HERE
```

### Step 3: Get Testnet Funds

#### Ethereum Sepolia Testnet:
1. Add Sepolia to MetaMask:
   - Network: Sepolia Testnet
   - RPC: https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   - Chain ID: 11155111
   - Symbol: ETH

2. Get test ETH:
   - Sepolia Faucet: https://sepoliafaucet.com
   - Infura Faucet: https://www.infura.io/faucet/sepolia
   - Alchemy Faucet: https://sepoliafaucet.com

#### Stellar Testnet:
1. Fund your account: https://friendbot.stellar.org
2. Paste your Stellar public key and get 10,000 XLM

### Step 4: Database Setup

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up postgres redis -d

# Run database migrations
cd relayer
pnpm prisma migrate dev
pnpm prisma generate
cd ..
```

### Step 5: Contract Deployment

#### Deploy Ethereum Contracts:
```bash
cd contracts/ethereum

# Compile contracts
pnpm compile

# Deploy to Sepolia testnet
pnpm deploy:sepolia

# Note: Copy the deployed contract addresses!
# Update HTLC_CONTRACT_ADDRESS in your .env files
```

#### Deploy Stellar Contracts:
```bash
cd contracts/stellar

# Build contracts
cargo build --release

# Deploy (requires Stellar CLI setup)
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/stellar_bridge.wasm --source YOUR_STELLAR_SECRET_KEY --network testnet

# Note: Copy the contract ID and update STELLAR_CONTRACT_ID in .env
```

### Step 6: Start Application

```bash
# From project root, start all services
pnpm dev

# This starts:
# - Frontend: http://localhost:3000
# - Relayer API: http://localhost:3001  
# - WebSocket: ws://localhost:3001
```

## 🧪 Testing the Setup

### Test Contract Deployment:
```bash
cd contracts/ethereum
pnpm test
```

### Test API Health:
```bash
curl http://localhost:3001/api/status/health
```

### Test Frontend:
1. Open http://localhost:3000
2. Connect MetaMask (Sepolia network)
3. Try a test swap

## 📊 Application Workflow

### How the App Works:

1. **User Initiates Swap**:
   - User connects wallets (MetaMask + Stellar)
   - Selects tokens (ETH → XLM or vice versa)
   - Sets amount and submits swap

2. **Cross-Chain Coordination**:
   - Relayer creates HTLC on source chain
   - Generates shared secret hash
   - Publishes swap order to auction

3. **Resolver Auction**:
   - Multiple resolvers bid on the swap
   - Best bid wins (lowest fee/fastest execution)
   - Partial fills supported for large orders

4. **Atomic Execution**:
   - Winner locks funds on destination chain
   - User reveals secret to claim destination tokens
   - Resolver uses secret to claim source tokens
   - Swap completes atomically

5. **Real-time Updates**:
   - WebSocket provides live progress updates
   - Analytics track volume, success rates
   - Error handling with automatic refunds

## 🔍 Key Components:

- **Frontend**: Next.js React app with wallet integration
- **Relayer**: Fastify API server coordinating swaps
- **Ethereum Contracts**: Solidity HTLC with partial fills
- **Stellar Contracts**: Rust/Soroban HTLC implementation
- **Database**: PostgreSQL for swap state management
- **Redis**: Caching and real-time data
- **WebSocket**: Live updates and notifications

## 🚨 Security Features:

- **Hash Time Locked Contracts (HTLC)**: Atomic swap guarantees
- **Timelock Refunds**: Automatic refunds if swaps fail
- **Resolver Staking**: Economic security for resolvers
- **Rate Limiting**: API protection
- **Input Validation**: Secure parameter handling

## 📱 Frontend Features:

- **Real-time Swap Tracking**: Live progress visualization
- **Wallet Integration**: MetaMask + Stellar wallets
- **Analytics Dashboard**: Volume, success rates, resolver performance
- **Resolver Interface**: Bidding and profit tracking
- **Responsive Design**: Mobile-friendly interface

## 🔧 Development Commands:

```bash
# Build everything
pnpm build

# Run tests
pnpm test
pnpm contracts:test

# Lint & format
pnpm lint
pnpm format

# Docker deployment
pnpm docker:build
pnpm docker:up
```

## 🐛 Troubleshooting:

### Common Issues:

1. **Gas Estimation Failed**:
   - Check if you have enough testnet ETH
   - Verify RPC URL is correct
   - Increase gas limit in transaction

2. **Contract Not Found**:
   - Verify contract addresses in .env
   - Check if contracts are deployed
   - Confirm network is Sepolia (chainId: 11155111)

3. **Database Connection Failed**:
   - Start PostgreSQL: `docker-compose up postgres -d`
   - Check DATABASE_URL in .env
   - Run migrations: `pnpm prisma migrate dev`

4. **Stellar Transaction Failed**:
   - Check account has XLM balance
   - Verify secret key format (starts with 'S')
   - Confirm using testnet network

## 🎯 Demo Scenarios:

1. **Simple ETH → XLM Swap**:
   - Amount: 0.1 ETH
   - Expected: ~equivalent XLM (minus fees)
   - Time: 30-60 seconds

2. **Large Partial Fill Order**:
   - Amount: 5 ETH → XLM
   - Multiple resolvers fill portions
   - Watch resolver auction in real-time

3. **Cross-chain Analytics**:
   - View swap volume charts
   - Monitor resolver performance
   - Track success rates

## 🏆 Submission Checklist:

- ✅ Fixed critical hardhat configuration errors
- ✅ Removed exposed private keys and API keys  
- ✅ Created comprehensive setup documentation
- ✅ Added testnet configuration for safe testing
- ✅ Provided step-by-step deployment guide
- ✅ Documented complete application workflow
- ✅ Added troubleshooting for common issues

**Ready for demo in production environment! 🚀**