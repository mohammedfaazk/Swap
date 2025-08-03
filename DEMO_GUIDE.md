# StellarBridge Production Demo Guide

## 🎯 Demo Overview

This guide demonstrates the complete ETH ↔ XLM atomic swap functionality in a production-ready environment with enterprise-grade security, monitoring, and scalability features.

## 🚀 Quick Demo Setup

### 1. Prerequisites Check

Ensure you have the following installed:
```bash
node --version    # v18+
docker --version  # 20.10+
pnpm --version    # 8.0+
```

### 2. One-Command Setup

```bash
# Clone and deploy in one command
git clone https://github.com/stellarbridge/production-swap
cd production-swap
./scripts/production-deploy.sh development
```

This will:
- ✅ Install all dependencies
- ✅ Setup local PostgreSQL and Redis
- ✅ Deploy smart contracts to local testnet
- ✅ Start all services with monitoring
- ✅ Run health checks and verification

### 3. Access Demo

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Documentation**: http://localhost:3001/documentation
- **Metrics**: http://localhost:3001/metrics
- **Health Check**: http://localhost:3001/health

## 💫 Demo Scenarios

### Scenario 1: ETH → XLM Swap (Basic)

**Objective**: Demonstrate basic cross-chain atomic swap from Ethereum to Stellar

#### Step 1: Wallet Connection
1. Open http://localhost:3000
2. Click "Connect MetaMask" (Ethereum)
3. Click "Connect Freighter" (Stellar)
4. Verify network indicators show green (connected)

#### Step 2: Configure Swap
1. Select "ETH → XLM" direction
2. Enter amount: `0.1 ETH`
3. Enter Stellar address: `GDYQCPUX2W6GLVOCFAQLEVAPH7AVZ2M5E7WAFBEGNZL5ICUWDATPHT5Q`
4. Review security checks (all should be green)
5. Review fee breakdown

#### Step 3: Execute Swap
1. Click "Initiate ETH → XLM Swap"
2. Review transaction warning
3. Click "Confirm Production Swap"
4. Approve MetaMask transaction
5. Monitor real-time progress
6. Observe completion notification

#### Expected Results
- ✅ ETH locked in HTLC contract
- ✅ Cross-chain coordination triggered
- ✅ XLM delivered to Stellar address
- ✅ Atomic swap completed in <5 minutes
- ✅ Transaction hashes available for both chains

### Scenario 2: XLM → ETH Swap (Reverse)

**Objective**: Demonstrate reverse swap with partial fills

#### Step 1: Configure Reverse Swap
1. Click direction toggle (🔄)
2. Select "XLM → ETH"
3. Enter amount: `250 XLM`
4. Enter Ethereum address: `0x322D58f69e8C06a1e6640e31a79e34AdcD8bf5CA`

#### Step 2: Advanced Options
1. Click "Advanced Options"
2. Enable "Partial Fills"
3. Set minimum fill: `50 XLM`
4. Set custom timelock: `7200` (2 hours)

#### Step 3: Execute and Monitor
1. Initiate swap
2. Approve Freighter transaction
3. Monitor WebSocket updates
4. Observe security validations
5. Confirm completion

#### Expected Results
- ✅ XLM sent to bridge contract
- ✅ Multi-signature validation
- ✅ ETH delivered atomically
- ✅ Partial fill optimization applied
- ✅ Custom timelock respected

### Scenario 3: Production Features Demo

**Objective**: Showcase enterprise-grade features

#### Network Resilience
1. Disconnect internet during swap
2. Observe automatic retry mechanisms
3. See failover to backup RPC endpoints
4. Verify transaction recovery

#### Security Features
1. Attempt invalid address format
2. Try amount exceeding limits
3. Test with insufficient balance
4. Observe security check failures

#### Monitoring & Analytics
1. Access `/metrics` endpoint
2. View real-time swap statistics
3. Monitor network health indicators
4. Check error rates and performance

#### API Integration
1. Access `/documentation` for Swagger UI
2. Test API endpoints directly
3. Demonstrate programmatic access
4. Show WebSocket real-time updates

## 🔧 Advanced Demo Features

### Multi-Network Support

**Testnet Configuration**:
```bash
# Switch to Sepolia testnet
export ETHEREUM_NETWORK=sepolia
export STELLAR_NETWORK=testnet

# Restart services
docker-compose restart
```

**Mainnet Configuration** (Demo only):
```bash
# Configure mainnet (read-only demo)
export ETHEREUM_NETWORK=mainnet
export STELLAR_NETWORK=mainnet
export DEMO_MODE=true
```

### Performance Testing

**Load Testing**:
```bash
# Run concurrent swap simulations
cd tools/benchmarks
npm run load-test -- --concurrent=10 --duration=60s
```

**Stress Testing**:
```bash
# Test system limits
npm run stress-test -- --swaps=1000 --rate=10/s
```

### Monitoring Demo

**Grafana Dashboard**:
```bash
# Access monitoring dashboard
open http://localhost:3000/grafana
# Default login: admin/admin
```

**Prometheus Metrics**:
```bash
# View raw metrics
curl http://localhost:3001/metrics | head -20
```

**Health Monitoring**:
```bash
# Continuous health check
watch -n 5 curl -s http://localhost:3001/health | jq
```

## 📊 Demo Metrics & KPIs

### Success Metrics
- **Swap Success Rate**: >99.5%
- **Average Completion Time**: <5 minutes
- **Network Uptime**: >99.9%
- **Security Violations**: 0

### Performance Metrics
- **API Response Time**: <200ms
- **WebSocket Latency**: <50ms
- **Database Query Time**: <10ms
- **Memory Usage**: <512MB per service

### Business Metrics
- **Daily Volume**: Simulated $1M+
- **Transaction Fees**: 0.3% per swap
- **User Retention**: Tracked via analytics
- **Error Rate**: <0.1%

## 🎬 Demo Script

### 5-Minute Executive Demo

**Minute 1: Introduction**
> "StellarBridge is a production-ready cross-chain atomic swap platform enabling seamless ETH ↔ XLM transfers with enterprise-grade security."

**Minute 2: User Experience**
> "Users simply connect their wallets, enter amounts, and execute swaps. The system handles all complexity behind the scenes."

**Minute 3: Security & Reliability**
> "Every swap uses atomic transactions with timelock protection. Multi-signature validation ensures security while automatic monitoring ensures reliability."

**Minute 4: Performance & Scale**
> "Real-time monitoring shows 99.9% uptime, sub-5-minute completion times, and horizontal scaling capability for enterprise volume."

**Minute 5: Technical Excellence**
> "Built with production-grade architecture: Docker containers, Kubernetes deployment, comprehensive monitoring, and disaster recovery."

### 15-Minute Technical Deep-Dive

1. **Architecture Overview** (3 min)
   - System components
   - Security layers
   - Scalability design

2. **Live Swap Demo** (5 min)
   - ETH → XLM execution
   - Real-time monitoring
   - Error handling

3. **Production Features** (4 min)
   - Multi-network support
   - Analytics dashboard
   - API capabilities

4. **Deployment & Operations** (3 min)
   - One-command deployment
   - Monitoring setup
   - Maintenance procedures

### 30-Minute Comprehensive Demo

Includes all above plus:
- Smart contract code walkthrough
- Security audit results
- Performance benchmarks
- Integration examples
- Roadmap and scaling plans

## 🔍 Troubleshooting Demo Issues

### Common Issues

**MetaMask Connection Failed**:
```bash
# Check MetaMask network
# Ensure localhost:8545 is added as custom RPC
# Verify account has test ETH
```

**Freighter Connection Failed**:
```bash
# Ensure Freighter extension is installed
# Switch to Stellar testnet
# Fund account via Stellar Laboratory
```

**Service Health Issues**:
```bash
# Check all services are running
docker-compose ps

# View service logs
docker-compose logs -f relayer
docker-compose logs -f frontend
```

**Database Connection Issues**:
```bash
# Reset database
docker-compose down
docker volume prune
./scripts/production-deploy.sh development
```

### Demo Recovery

**Quick Reset**:
```bash
# Reset all services and data
./scripts/reset-demo.sh
```

**Partial Reset**:
```bash
# Reset only application state
docker-compose restart relayer frontend
```

## 📱 Mobile Demo

### Responsive Design
- Test on mobile browsers
- Demonstrate wallet connectivity
- Show optimized UI/UX

### Progressive Web App
- Add to home screen
- Offline capabilities
- Push notifications

## 🌐 Live Demo Environment

### Staging Environment
- **URL**: https://staging.stellarbridge.io
- **Features**: Full production features
- **Data**: Test data with reset capability

### Demo Accounts
- **Ethereum**: Pre-funded testnet accounts
- **Stellar**: Test accounts with XLM
- **API Keys**: Demo-specific rate limits

## 📈 Demo Analytics

### Real-Time Dashboard
Track demo performance:
- Concurrent users
- Swap success rates
- Average completion times
- Error frequencies

### Demo Feedback
Collect feedback on:
- User experience
- Feature requests
- Performance perception
- Integration complexity

## 🚀 Next Steps After Demo

### For Developers
1. Explore API documentation
2. Clone repository for local development
3. Join developer community
4. Access SDK and tools

### For Enterprises
1. Schedule technical consultation
2. Discuss integration requirements
3. Review security audit reports
4. Plan pilot deployment

### For Partners
1. Explore partnership opportunities
2. Discuss revenue sharing models
3. Review white-label options
4. Plan go-to-market strategy

## 📞 Demo Support

### During Demo
- **Slack**: #stellarbridge-demo
- **Email**: demo@stellarbridge.io
- **Phone**: +1-800-STELLAR

### After Demo
- **Documentation**: https://docs.stellarbridge.io
- **Community**: https://community.stellarbridge.io
- **Support**: https://support.stellarbridge.io

---

**Ready to revolutionize cross-chain swaps? Let's build the future of decentralized finance together!** 🚀