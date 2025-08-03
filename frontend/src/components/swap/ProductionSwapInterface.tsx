"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SwapProgress } from "./SwapProgress";
import { SwapDetails } from "./SwapDetails";
import { RealTransactionWarning } from "./RealTransactionWarning";
import { useMultiWallet } from "../wallet/WalletProvider";
import { useStellarWallet } from "../wallet/StellarWalletProvider";
import { useProductionSwap } from "@/hooks/useProductionSwap";
import { 
  ArrowUpDown, 
  AlertTriangle, 
  Info, 
  Coins, 
  Zap, 
  RefreshCw, 
  Shield, 
  Network,
  Clock,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { ethers } from "ethers";

interface NetworkIndicatorProps {
  network: string;
  connected: boolean;
  blockHeight?: number;
  gasPrice?: string;
  ledger?: number;
  baseFee?: string;
}

function NetworkIndicator({ network, connected, blockHeight, gasPrice, ledger, baseFee }: NetworkIndicatorProps) {
  return (
    <div className={`flex items-center space-x-2 p-2 rounded-lg border ${
      connected ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'
    }`}>
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="text-sm font-medium">{network}</span>
      {connected && blockHeight && (
        <span className="text-xs text-gray-400">Block: {blockHeight}</span>
      )}
      {connected && gasPrice && (
        <span className="text-xs text-gray-400">Gas: {gasPrice}</span>
      )}
      {connected && ledger && (
        <span className="text-xs text-gray-400">Ledger: {ledger}</span>
      )}
    </div>
  );
}

interface SecurityChecksProps {
  checks: {
    addressValidation: boolean;
    networkValidation: boolean;
    amountValidation: boolean;
    timelockValidation: boolean;
  };
}

function SecurityChecks({ checks }: SecurityChecksProps) {
  const checkItems = [
    { key: 'addressValidation', label: 'Address Format', check: checks.addressValidation },
    { key: 'networkValidation', label: 'Network Status', check: checks.networkValidation },
    { key: 'amountValidation', label: 'Amount Limits', check: checks.amountValidation },
    { key: 'timelockValidation', label: 'Timelock Range', check: checks.timelockValidation },
  ];

  return (
    <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
      <div className="flex items-center space-x-2 mb-3">
        <Shield className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-blue-400">Security Validation</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {checkItems.map(({ key, label, check }) => (
          <div key={key} className="flex items-center space-x-2">
            {check ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
            <span className={`text-xs ${check ? 'text-green-400' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductionSwapInterface() {
  const [direction, setDirection] = useState<"ETH_TO_XLM" | "XLM_TO_ETH">("ETH_TO_XLM");
  const [fromAmount, setFromAmount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [enablePartialFill, setEnablePartialFill] = useState(false);
  const [minFillAmount, setMinFillAmount] = useState("");
  const [customTimelock, setCustomTimelock] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRealTxWarning, setShowRealTxWarning] = useState(false);

  const { isConnected: ethConnected, balance: ethBalance, isWrongNetwork } = useMultiWallet();
  const { isConnected: stellarConnected, balance: stellarBalance } = useStellarWallet();
  
  const { 
    swapState, 
    networkStatus, 
    initiateSwap, 
    getSwapFees, 
    resetSwap, 
    getNetworkInfo,
    isSwapping,
    isConnected,
    supportedNetworks,
    productionConfig 
  } = useProductionSwap();

  // Validation
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (fromAmount) {
      const amount = parseFloat(fromAmount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.fromAmount = "Please enter a valid amount";
      } else if (amount < productionConfig.limits.minAmount) {
        newErrors.fromAmount = `Minimum amount is ${productionConfig.limits.minAmount}`;
      } else if (amount > productionConfig.limits.maxAmount) {
        newErrors.fromAmount = `Maximum amount is ${productionConfig.limits.maxAmount}`;
      } else if (direction === "ETH_TO_XLM" && amount > parseFloat(ethBalance)) {
        newErrors.fromAmount = "Insufficient ETH balance";
      } else if (direction === "XLM_TO_ETH" && amount > parseFloat(stellarBalance)) {
        newErrors.fromAmount = "Insufficient XLM balance";
      }
    }

    if (toAccount) {
      if (direction === "ETH_TO_XLM") {
        if (!toAccount.startsWith("G") || toAccount.length !== 56) {
          newErrors.toAccount = "Invalid Stellar address. Must start with 'G' and be 56 characters";
        }
      } else {
        try {
          if (!ethers.isAddress(toAccount)) {
            newErrors.toAccount = "Invalid Ethereum address format";
          }
        } catch {
          newErrors.toAccount = "Invalid Ethereum address format";
        }
      }
    }

    if (customTimelock) {
      const timelock = parseInt(customTimelock);
      if (isNaN(timelock) || timelock < 3600 || timelock > 259200) {
        newErrors.customTimelock = "Timelock must be between 1 hour and 72 hours";
      }
    }

    if (enablePartialFill && minFillAmount) {
      const minAmount = parseFloat(minFillAmount);
      if (isNaN(minAmount) || minAmount <= 0) {
        newErrors.minFillAmount = "Please enter a valid minimum fill amount";
      } else if (fromAmount && minAmount >= parseFloat(fromAmount)) {
        newErrors.minFillAmount = "Minimum fill must be less than total amount";
      }
    }

    setErrors(newErrors);
  }, [fromAmount, toAccount, customTimelock, minFillAmount, enablePartialFill, direction, ethBalance, stellarBalance, productionConfig]);

  const handleSwap = async () => {
    if (direction === "ETH_TO_XLM" && !ethConnected) {
      alert("Please connect your Ethereum wallet first");
      return;
    }
    if (direction === "XLM_TO_ETH" && !stellarConnected) {
      alert("Please connect your Stellar wallet first");
    }
    
    setShowRealTxWarning(true);
  };

  const executeRealSwap = async () => {
    setShowRealTxWarning(false);
    
    const timelock = customTimelock ? parseInt(customTimelock) : productionConfig.defaultTimelock;
    
    await initiateSwap({
      direction,
      fromAmount,
      toAccount,
      partial: enablePartialFill,
      minFill: enablePartialFill ? parseFloat(minFillAmount || "0") : undefined,
      timelock,
    });
  };

  const toggleDirection = () => {
    setDirection(prev => prev === "ETH_TO_XLM" ? "XLM_TO_ETH" : "ETH_TO_XLM");
    setFromAmount("");
    setToAccount("");
    setErrors({});
  };

  const isFormValid = !Object.keys(errors).length && 
                     fromAmount && 
                     toAccount && 
                     isConnected &&
                     !isWrongNetwork &&
                     (!enablePartialFill || minFillAmount);

  const fees = fromAmount ? getSwapFees(direction, fromAmount) : null;
  const networkInfo = getNetworkInfo();

  if (showRealTxWarning) {
    return (
      <RealTransactionWarning
        amount={fromAmount}
        destinationAddress={toAccount}
        onConfirm={executeRealSwap}
        onCancel={() => setShowRealTxWarning(false)}
      />
    );
  }

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-2xl p-8 max-w-4xl mx-auto">
      {/* Header with Network Status */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Production Atomic Swap</h2>
          <p className="text-sm text-slate-400 mt-1">Enterprise-grade cross-chain bridge</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <Coins className="w-4 h-4" />
          <span>Multi-Network Support</span>
        </div>
      </div>

      {/* Network Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <NetworkIndicator
          network="Ethereum (Sepolia)"
          connected={networkStatus.ethereum.connected}
          blockHeight={networkStatus.ethereum.blockHeight}
          gasPrice={networkStatus.ethereum.gasPrice}
        />
        <NetworkIndicator
          network="Stellar (Testnet)"
          connected={networkStatus.stellar.connected}
          ledger={networkStatus.stellar.ledger}
          baseFee={networkStatus.stellar.baseFee}
        />
      </div>

      {/* Connection Status Alert */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="text-sm text-red-100">
              <strong>Network Connection Required:</strong> Please ensure both Ethereum and Stellar networks are accessible for cross-chain operations.
            </div>
          </div>
        </div>
      )}

      {/* Direction Toggle */}
      <div className="mb-8">
        <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">
                {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}
              </div>
              <div className="text-sm text-slate-400">
                {direction === "ETH_TO_XLM" ? "Ethereum Sepolia" : "Stellar Testnet"}
              </div>
              <div className="text-xs text-green-400 mt-1">
                {direction === "ETH_TO_XLM" && networkStatus.ethereum.connected && "✓ Connected"}
                {direction === "XLM_TO_ETH" && networkStatus.stellar.connected && "✓ Connected"}
              </div>
            </div>
            
            <button
              onClick={toggleDirection}
              className="p-3 bg-brand/20 hover:bg-brand/30 rounded-full transition-colors group"
              disabled={isSwapping}
            >
              <ArrowUpDown className="w-6 h-6 text-brand group-hover:rotate-180 transition-transform duration-300" />
            </button>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">
                {direction === "ETH_TO_XLM" ? "XLM" : "ETH"}
              </div>
              <div className="text-sm text-slate-400">
                {direction === "ETH_TO_XLM" ? "Stellar Testnet" : "Ethereum Sepolia"}
              </div>
              <div className="text-xs text-green-400 mt-1">
                {direction === "ETH_TO_XLM" && networkStatus.stellar.connected && "✓ Connected"}
                {direction === "XLM_TO_ETH" && networkStatus.ethereum.connected && "✓ Connected"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Amount to Swap
        </label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            disabled={!isConnected || isSwapping}
            className={errors.fromAmount ? "border-red-500 focus:ring-red-500" : ""}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}
          </div>
        </div>
        {isConnected && (
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>
              Balance: {direction === "ETH_TO_XLM" ? 
                parseFloat(ethBalance).toFixed(4) + " ETH" : 
                parseFloat(stellarBalance).toFixed(4) + " XLM"}
            </span>
            <span>
              Limits: {productionConfig.limits.minAmount} - {productionConfig.limits.maxAmount}
            </span>
          </div>
        )}
        {errors.fromAmount && (
          <div className="flex items-center space-x-2 text-red-400 text-sm mt-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errors.fromAmount}</span>
          </div>
        )}
      </div>

      {/* Destination Address */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-3">
          {direction === "ETH_TO_XLM" ? "Stellar Wallet Address" : "Ethereum Wallet Address"}
        </label>
        <Input
          type="text"
          placeholder={
            direction === "ETH_TO_XLM" 
              ? "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" 
              : "0x0000000000000000000000000000000000000000"
          }
          value={toAccount}
          onChange={(e) => setToAccount(e.target.value)}
          disabled={!isConnected || isSwapping}
          className={errors.toAccount ? "border-red-500 focus:ring-red-500" : ""}
        />
        <div className="text-xs text-slate-400 mt-2">
          {direction === "ETH_TO_XLM" 
            ? "Enter Stellar wallet address to receive XLM (starts with G)" 
            : "Enter Ethereum wallet address to receive ETH (starts with 0x)"}
        </div>
        {errors.toAccount && (
          <div className="flex items-center space-x-2 text-red-400 text-sm mt-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errors.toAccount}</span>
          </div>
        )}
      </div>

      {/* Security Checks */}
      {fromAmount && toAccount && (
        <div className="mb-6">
          <SecurityChecks checks={swapState.securityChecks} />
        </div>
      )}

      {/* Advanced Options */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-brand hover:text-brand/80 transition-colors"
        >
          <span className="text-sm font-medium">Advanced Options</span>
          <ArrowUpDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
        
        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
            {/* Custom Timelock */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Custom Timelock (seconds)
              </label>
              <Input
                type="number"
                placeholder={productionConfig.defaultTimelock.toString()}
                value={customTimelock}
                onChange={(e) => setCustomTimelock(e.target.value)}
                disabled={!isConnected || isSwapping}
                className={errors.customTimelock ? "border-red-500 focus:ring-red-500" : ""}
              />
              <div className="text-xs text-slate-400 mt-1">
                Default: {productionConfig.defaultTimelock / 3600} hours (Range: 1-72 hours)
              </div>
              {errors.customTimelock && (
                <div className="text-red-400 text-xs mt-1">{errors.customTimelock}</div>
              )}
            </div>

            {/* Partial Fill Option */}
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={enablePartialFill}
                  onChange={(e) => setEnablePartialFill(e.target.checked)}
                  disabled={!isConnected || isSwapping}
                  className="w-4 h-4 text-brand bg-slate-700 border-slate-600 rounded focus:ring-brand"
                />
                <span className="text-white font-medium">Enable Partial Fills</span>
              </label>
              
              {enablePartialFill && (
                <div className="mt-3">
                  <label className="block text-sm text-slate-300 mb-2">
                    Minimum Fill Amount
                  </label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={minFillAmount}
                    onChange={(e) => setMinFillAmount(e.target.value)}
                    disabled={!isConnected || isSwapping}
                    className={errors.minFillAmount ? "border-red-500 focus:ring-red-500" : ""}
                  />
                  {errors.minFillAmount && (
                    <div className="text-red-400 text-xs mt-1">{errors.minFillAmount}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fee Breakdown */}
      {fromAmount && fees && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="flex items-center space-x-2 mb-3">
            <DollarSign className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">Fee Breakdown</span>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Network Fee:</span>
              <span className="text-white">{fees.networkFee} {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bridge Fee (0.3%):</span>
              <span className="text-white">{fees.bridgeFee} {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}</span>
            </div>
            <div className="flex justify-between border-t border-slate-600 pt-2">
              <span className="text-slate-300 font-medium">Total Fees:</span>
              <span className="text-white font-bold">{fees.total} {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}</span>
            </div>
          </div>
          
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="text-xs text-blue-200">
              <strong>🔄 Production Bridge:</strong> Secure cross-chain transfer with multi-signature validation
              and 24/7 monitoring. Estimated completion: 3-5 minutes.
            </div>
          </div>
        </div>
      )}

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!isFormValid || isSwapping}
        className="w-full py-4 text-lg font-bold bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 border-brand"
        size="lg"
      >
        <Zap className="w-5 h-5 mr-2" />
        {!isConnected ? "Connect Networks" :
         !ethConnected && direction === "ETH_TO_XLM" ? "Connect MetaMask" :
         !stellarConnected && direction === "XLM_TO_ETH" ? "Connect Freighter" :
         isWrongNetwork ? "Switch Network" :
         isSwapping ? "Processing Production Swap..." :
         `Initiate ${direction.replace('_', ' → ')} Swap`}
      </Button>

      {/* Retry Button (if failed) */}
      {swapState.status === 'failed' && (
        <Button
          onClick={() => executeRealSwap()}
          variant="outline"
          className="w-full mt-4 text-orange-400 border-orange-500 hover:bg-orange-900/20"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Swap ({swapState.retryCount}/3)
        </Button>
      )}

      {/* Reset Button */}
      {(swapState.status === 'completed' || swapState.status === 'failed') && (
        <Button
          onClick={resetSwap}
          variant="ghost"
          className="w-full mt-2 text-slate-400 hover:text-white"
        >
          Start New Swap
        </Button>
      )}

      {/* Swap Progress */}
      <SwapProgress progress={swapState.progress} status={swapState.status} />

      {/* Swap Details */}
      <SwapDetails 
        swapState={swapState}
        onComplete={() => {}}
        onRefund={() => {}}
        onReset={resetSwap}
      />

      {/* Production Features Notice */}
      {isConnected && !isWrongNetwork && swapState.status === 'idle' && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
              <div className="text-sm text-green-100">
                <strong>✨ Production Ready:</strong> Multi-signature validation, real-time monitoring, 
                automatic failover, and enterprise-grade security controls.
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Network className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-100">
                <strong>🌐 Multi-Network:</strong> Supports Ethereum Mainnet, Sepolia, Goerli testnets 
                and Stellar Mainnet, Testnet with automatic network detection.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}