"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SwapProgress } from "./SwapProgress";
import { SwapDetails } from "./SwapDetails";
import { RealTransactionWarning } from "./RealTransactionWarning";
import { useWallet } from "@/hooks/useWallet";
import { useSwap } from "@/hooks/useSwap";
import { ArrowUpDown, AlertTriangle, Info, Coins, Zap } from "lucide-react";
import { ethers } from "ethers";

export function SwapInterface() {
  const [direction, setDirection] = useState<"ETH_TO_XLM" | "XLM_TO_ETH">("ETH_TO_XLM");
  const [fromAmount, setFromAmount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [enablePartialFill, setEnablePartialFill] = useState(false);
  const [minFillAmount, setMinFillAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRealTxWarning, setShowRealTxWarning] = useState(false);

  const { isConnected, address, balance, isWrongNetwork } = useWallet();
  const { initiateSwap, completeSwap, refundSwap, resetSwap, progress, status, swapState } = useSwap();

  // Validation
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (fromAmount) {
      const amount = parseFloat(fromAmount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.fromAmount = "Please enter a valid amount";
      } else if (direction === "ETH_TO_XLM" && amount > parseFloat(balance)) {
        newErrors.fromAmount = "Insufficient balance";
      } else if (amount < 0.001) {
        newErrors.fromAmount = "Minimum amount is 0.001";
      }
    }

    if (toAccount) {
      if (direction === "ETH_TO_XLM") {
        // Validate Stellar address
        if (!toAccount.startsWith("G") || toAccount.length !== 56) {
          newErrors.toAccount = "Invalid Stellar address. Must start with 'G' and be 56 characters";
        }
      } else {
        // Validate Ethereum address
        if (!ethers.isAddress(toAccount)) {
          newErrors.toAccount = "Invalid Ethereum address";
        }
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
  }, [fromAmount, toAccount, minFillAmount, enablePartialFill, direction, balance]);

  const handleSwap = async () => {
    if (!isConnected) return;
    
    // Show warning for real transaction
    setShowRealTxWarning(true);
  };

  const executeRealSwap = async () => {
    setShowRealTxWarning(false);
    
    await initiateSwap({
      direction,
      fromAmount,
      toAccount,
      partial: enablePartialFill,
      minFill: enablePartialFill ? parseFloat(minFillAmount || "0") : undefined
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

  const estimatedReceive = fromAmount ? (parseFloat(fromAmount) * 0.998).toFixed(6) : "0.00";

  // Show real transaction warning modal
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
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-2xl p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Atomic Swap</h2>
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <Coins className="w-4 h-4" />
          <span>Cross-Chain Exchange</span>
        </div>
      </div>

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
            </div>
            
            <button
              onClick={toggleDirection}
              className="p-3 bg-brand/20 hover:bg-brand/30 rounded-full transition-colors group"
              disabled={progress > 0}
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
            disabled={!isConnected || progress > 0}
            className={errors.fromAmount ? "border-red-500 focus:ring-red-500" : ""}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}
          </div>
        </div>
        {isConnected && (
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Balance: {parseFloat(balance).toFixed(4)} {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}</span>
            <button
              onClick={() => setFromAmount((parseFloat(balance) * 0.95).toFixed(6))}
              className="text-brand hover:underline"
              disabled={progress > 0}
            >
              Use Max (95%)
            </button>
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
          Destination Address
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
          disabled={!isConnected || progress > 0}
          className={errors.toAccount ? "border-red-500 focus:ring-red-500" : ""}
        />
        <div className="text-xs text-slate-400 mt-2">
          {direction === "ETH_TO_XLM" 
            ? "Enter a valid Stellar address (starts with G)" 
            : "Enter a valid Ethereum address (starts with 0x)"}
        </div>
        {errors.toAccount && (
          <div className="flex items-center space-x-2 text-red-400 text-sm mt-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errors.toAccount}</span>
          </div>
        )}
      </div>

      {/* Partial Fill Option */}
      <div className="mb-6">
        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={enablePartialFill}
                onChange={(e) => setEnablePartialFill(e.target.checked)}
                disabled={!isConnected || progress > 0}
                className="w-4 h-4 text-brand bg-slate-700 border-slate-600 rounded focus:ring-brand"
              />
              <span className="text-white font-medium">Enable Partial Fills</span>
            </label>
            <div className="flex items-center space-x-1 text-slate-400">
              <Info className="w-4 h-4" />
              <span className="text-xs">Advanced</span>
            </div>
          </div>
          
          {enablePartialFill && (
            <div className="mt-4">
              <label className="block text-sm text-slate-300 mb-2">
                Minimum Fill Amount
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={minFillAmount}
                onChange={(e) => setMinFillAmount(e.target.value)}
                disabled={!isConnected || progress > 0}
                className={errors.minFillAmount ? "border-red-500 focus:ring-red-500" : ""}
              />
              {errors.minFillAmount && (
                <div className="flex items-center space-x-2 text-red-400 text-sm mt-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{errors.minFillAmount}</span>
                </div>
              )}
            </div>
          )}
          
          <div className="text-xs text-slate-400 mt-2">
            Allow multiple resolvers to fill portions of your order for better liquidity
          </div>
        </div>
      </div>

      {/* Estimated Receive */}
      {fromAmount && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Estimated Receive:</span>
            <span className="text-white font-medium">
              {estimatedReceive} {direction === "ETH_TO_XLM" ? "XLM" : "ETH"}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            * Includes 0.2% network fee estimate
          </div>
        </div>
      )}

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!isFormValid || progress > 0}
        className="w-full py-4 text-lg font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-red-500"
        size="lg"
      >
        <Zap className="w-5 h-5 mr-2" />
        {!isConnected ? "Connect Wallet" :
         isWrongNetwork ? "Switch to Sepolia" :
         progress > 0 ? "Processing Real Transaction..." :
         "🚀 Execute Real Crypto Swap"}
      </Button>

      {/* Swap Progress */}
      <SwapProgress progress={progress} status={status} />

      {/* Swap Details */}
      <SwapDetails
        swapState={swapState}
        onComplete={completeSwap}
        onRefund={refundSwap}
        onReset={resetSwap}
      />

      {/* Real Transaction Warning */}
      {isConnected && !isWrongNetwork && swapState.status === 'idle' && (
        <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="text-sm text-red-100">
              <strong>⚠️ REAL TRANSACTIONS:</strong> This will execute actual blockchain transactions 
              that move cryptocurrency from your wallet on Sepolia testnet. Make sure you have 
              test ETH and have verified the destination address.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}