# Project Initialization Script for Windows PowerShell
# This script automates dependency installation and Prisma setup for the Swap monorepo.
# Usage: Right-click and run with PowerShell, or run: powershell -ExecutionPolicy Bypass -File ./init-project.ps1

Write-Host "[1/4] Installing all dependencies with pnpm..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Host "pnpm install failed. Exiting." -ForegroundColor Red; exit 1 }

# Prisma setup for relayer
Write-Host "[2/4] Setting up Prisma in relayer..." -ForegroundColor Cyan
if (Test-Path "./relayer/prisma/schema.prisma") {
    Set-Location relayer
    pnpm exec prisma generate
    if ($LASTEXITCODE -ne 0) { Write-Host "Prisma generate failed. Exiting." -ForegroundColor Red; exit 1 }
    pnpm exec prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { Write-Host "Prisma migrate failed. Exiting." -ForegroundColor Red; exit 1 }
    Set-Location ..
} else {
    Write-Host "No Prisma schema found in relayer. Skipping Prisma setup." -ForegroundColor Yellow
}

Write-Host "[3/4] Checking Hardhat network configuration..." -ForegroundColor Cyan
if (-not (Test-Path "./contracts/ethereum/hardhat.config.ts")) {
    Write-Host "Missing contracts/ethereum/hardhat.config.ts! Please create and configure your networks." -ForegroundColor Red
} else {
    $configContent = Get-Content ./contracts/ethereum/hardhat.config.ts -Raw
    if ($configContent -notmatch 'sepolia') {
        Write-Host "Warning: No sepolia network found in hardhat.config.ts. Please add it before deploying/verifying." -ForegroundColor Yellow
    } else {
        Write-Host "Hardhat config found and sepolia network appears to be configured." -ForegroundColor Green
    }
}

Write-Host "[4/4] Initialization complete!" -ForegroundColor Green
Write-Host "\nManual next steps:" -ForegroundColor Cyan
Write-Host "- Configure your Infura/Alchemy key and wallet private key in contracts/ethereum/hardhat.config.ts if not done."
Write-Host "- Deploy contracts: cd contracts/ethereum; pnpm exec hardhat run scripts/deploy.ts --network sepolia"
Write-Host "- Verify contracts: pnpm exec hardhat run scripts/verify.ts --network sepolia"
Write-Host "- Start frontend: cd frontend; pnpm dev"
Write-Host "- Start relayer: cd relayer; pnpm dev"
Write-Host "\nIf you need help with Hardhat config or deployment, let me know!" -ForegroundColor Cyan
