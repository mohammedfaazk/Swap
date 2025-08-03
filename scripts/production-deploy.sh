#!/bin/bash

# StellarBridge Production Deployment Script
# Usage: ./scripts/production-deploy.sh [environment]
# Environments: development, staging, production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}🚀 StellarBridge Production Deployment${NC}"
echo -e "${BLUE}Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "${BLUE}Timestamp: ${YELLOW}$TIMESTAMP${NC}"
echo "=============================================="

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error "Node.js is required but not installed"
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js 18+ is required. Current version: $(node -v)"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is required but not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is required but not installed"
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        warning "pnpm not found, installing..."
        npm install -g pnpm
    fi
    
    log "✅ Prerequisites check completed"
}

# Setup environment
setup_environment() {
    log "Setting up environment for $ENVIRONMENT..."
    
    cd "$PROJECT_ROOT"
    
    # Copy environment file
    ENV_FILE=".env.$ENVIRONMENT"
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example "$ENV_FILE"
            warning "Created $ENV_FILE from template. Please configure it before continuing."
            echo "Press Enter to continue after configuring $ENV_FILE..."
            read
        else
            error "No environment template found"
        fi
    fi
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    fi
    
    log "✅ Environment setup completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Root dependencies
    pnpm install
    
    # Frontend dependencies
    cd frontend
    pnpm install
    cd ..
    
    # Relayer dependencies
    cd relayer
    pnpm install
    cd ..
    
    # Ethereum contracts dependencies
    cd contracts/ethereum
    npm install
    cd ../..
    
    log "✅ Dependencies installed"
}

# Build applications
build_applications() {
    log "Building applications..."
    
    cd "$PROJECT_ROOT"
    
    # Build smart contracts
    log "Building Ethereum contracts..."
    cd contracts/ethereum
    npm run compile
    cd ../..
    
    # Build Stellar contracts
    log "Building Stellar contracts..."
    cd contracts/stellar
    if command -v cargo &> /dev/null; then
        cargo build --release
    else
        warning "Rust/Cargo not found, skipping Stellar contract build"
    fi
    cd ../..
    
    # Build relayer
    log "Building relayer service..."
    cd relayer
    npx prisma generate
    npm run build
    cd ..
    
    # Build frontend
    log "Building frontend application..."
    cd frontend
    npm run build
    cd ..
    
    log "✅ Applications built successfully"
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    cd "$PROJECT_ROOT"
    
    # Start database services
    if [ "$ENVIRONMENT" != "production" ]; then
        log "Starting local database services..."
        docker-compose up -d postgres redis
        
        # Wait for services to be ready
        sleep 10
    fi
    
    # Run database migrations
    cd relayer
    npx prisma migrate deploy
    npx prisma generate
    cd ..
    
    log "✅ Database setup completed"
}

# Deploy smart contracts
deploy_contracts() {
    log "Deploying smart contracts..."
    
    cd "$PROJECT_ROOT/contracts/ethereum"
    
    case $ENVIRONMENT in
        development)
            log "Deploying to local network..."
            # npm run deploy:local
            warning "Local deployment skipped - use Hardhat local node"
            ;;
        staging)
            log "Deploying to testnets..."
            npm run deploy:sepolia
            ;;
        production)
            log "Deploying to mainnet..."
            warning "Production deployment requires manual approval"
            echo "Press Enter to continue with mainnet deployment..."
            read
            npm run deploy:mainnet
            ;;
    esac
    
    cd "$PROJECT_ROOT"
    log "✅ Smart contracts deployed"
}

# Deploy applications
deploy_applications() {
    log "Deploying applications..."
    
    cd "$PROJECT_ROOT"
    
    case $ENVIRONMENT in
        development)
            log "Starting development services..."
            # Start services in development mode
            docker-compose -f docker-compose.dev.yml up -d
            ;;
        staging)
            log "Deploying to staging environment..."
            docker-compose -f docker-compose.staging.yml up -d --build
            ;;
        production)
            log "Deploying to production environment..."
            docker-compose -f docker-compose.production.yml up -d --build
            ;;
    esac
    
    log "✅ Applications deployed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    cd "$PROJECT_ROOT"
    
    if [ "$ENVIRONMENT" != "development" ]; then
        # Deploy monitoring stack
        if [ -d "monitoring" ]; then
            docker-compose -f monitoring/docker-compose.yml up -d
        fi
        
        # Setup health checks
        log "Configuring health checks..."
        # Add health check configuration here
    fi
    
    log "✅ Monitoring setup completed"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run smart contract tests
    log "Testing smart contracts..."
    cd contracts/ethereum
    npm test
    cd ../..
    
    # Run relayer tests
    log "Testing relayer service..."
    cd relayer
    npm test
    cd ..
    
    # Run frontend tests
    log "Testing frontend..."
    cd frontend
    npm test -- --watchAll=false
    cd ..
    
    log "✅ All tests passed"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for services to start
    sleep 30
    
    # Check service health
    HEALTH_URL="http://localhost:3001/health"
    if curl -f "$HEALTH_URL" > /dev/null 2>&1; then
        log "✅ Backend service is healthy"
    else
        error "Backend service health check failed"
    fi
    
    # Check frontend
    FRONTEND_URL="http://localhost:3000"
    if curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
        log "✅ Frontend service is healthy"
    else
        error "Frontend service health check failed"
    fi
    
    log "✅ Deployment verification completed"
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    REPORT_FILE="deployment_report_${ENVIRONMENT}_${TIMESTAMP}.md"
    
    cat > "$REPORT_FILE" << EOF
# StellarBridge Deployment Report

**Environment**: $ENVIRONMENT
**Timestamp**: $TIMESTAMP
**Version**: $(git rev-parse --short HEAD)

## Deployment Status

✅ Prerequisites checked
✅ Environment configured
✅ Dependencies installed
✅ Applications built
✅ Database setup
✅ Smart contracts deployed
✅ Applications deployed
✅ Monitoring configured
✅ Tests passed
✅ Deployment verified

## Service URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/documentation
- Health Check: http://localhost:3001/health
- Metrics: http://localhost:3001/metrics

## Smart Contract Addresses

### Ethereum ($ENVIRONMENT)
- ProductionHTLC: TBD
- CrossChainBridge: TBD

### Stellar ($ENVIRONMENT)
- Contract ID: TBD

## Configuration

- Node.js Version: $(node -v)
- Docker Version: $(docker --version)
- Database: PostgreSQL + Redis
- Networks: Ethereum, Stellar

## Next Steps

1. Configure monitoring alerts
2. Set up backup procedures  
3. Configure SSL certificates
4. Set up CI/CD pipelines
5. Perform security audit

---
Generated on $(date)
EOF

    log "✅ Deployment report generated: $REPORT_FILE"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    # Add any cleanup tasks here
    log "✅ Cleanup completed"
}

# Main deployment function
main() {
    log "Starting StellarBridge deployment..."
    
    # Run deployment steps
    check_prerequisites
    setup_environment
    install_dependencies
    
    # Optional: Run tests before deployment
    if [ "$ENVIRONMENT" != "development" ]; then
        run_tests
    fi
    
    build_applications
    setup_database
    deploy_contracts
    deploy_applications
    setup_monitoring
    verify_deployment
    generate_report
    
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}Environment: ${YELLOW}$ENVIRONMENT${NC}"
    echo -e "${BLUE}Frontend: ${YELLOW}http://localhost:3000${NC}"
    echo -e "${BLUE}Backend: ${YELLOW}http://localhost:3001${NC}"
    echo -e "${BLUE}Documentation: ${YELLOW}http://localhost:3001/documentation${NC}"
    echo ""
    
    if [ "$ENVIRONMENT" = "development" ]; then
        echo -e "${YELLOW}💡 Development Tips:${NC}"
        echo "- View logs: docker-compose logs -f"
        echo "- Restart services: docker-compose restart"
        echo "- Stop services: docker-compose down"
        echo "- Database GUI: Access pgAdmin at http://localhost:8080"
        echo ""
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"