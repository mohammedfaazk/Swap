"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SwapProgress } from "./SwapProgress";
import { SwapDetails } from "./SwapDetails";
import { RealTransactionWarning } from "./RealTransactionWarning";
import { useMultiWallet } from "../wallet/WalletProvider";
import { useStellarWallet } from "../wallet/StellarWalletProvider";
import { useSwap } from "@/hooks/useSwap";
import { ArrowUpDown, AlertTriangle, Info, Coins, Zap, RefreshCw } from "lucide-react";
import { ethers } from "ethers";
import { SimpleHTLCContract } from "@/contracts/SimpleHTLC";

export function SwapInterface() {
  const [direction, setDirection] = useState<"ETH_TO_XLM" | "XLM_TO_ETH">("ETH_TO_XLM");
  const [fromAmount, setFromAmount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [enablePartialFill, setEnablePartialFill] = useState(false);
  const [minFillAmount, setMinFillAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRealTxWarning, setShowRealTxWarning] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const { isConnected: ethConnected, balance: ethBalance, isWrongNetwork } = useMultiWallet();
  const { isConnected: stellarConnected, balance: stellarBalance } = useStellarWallet();
  const { initiateSwap, completeSwap, refundSwap, resetSwap, swapState } = useSwap();
  
  // Derive progress and status from swapState
  const progress = swapState.progress || 0;
  const status = swapState.status;

  // Validation
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (fromAmount) {
      const amount = parseFloat(fromAmount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.fromAmount = "Please enter a valid amount";
      } else if (direction === "ETH_TO_XLM" && amount > parseFloat(ethBalance)) {
        newErrors.fromAmount = "Insufficient ETH balance";
      } else if (direction === "XLM_TO_ETH" && amount > parseFloat(stellarBalance)) {
        newErrors.fromAmount = "Insufficient XLM balance";
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
        // Validate Ethereum address with better error handling
        try {
          if (!ethers.isAddress(toAccount)) {
            newErrors.toAccount = "Invalid Ethereum address format";
          } else if (toAccount.length !== 42) {
            newErrors.toAccount = "Ethereum address must be 42 characters";
          } else if (!toAccount.startsWith("0x")) {
            newErrors.toAccount = "Ethereum address must start with 0x";
          }
        } catch (ethError) {
          newErrors.toAccount = "Invalid Ethereum address format";
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
  }, [fromAmount, toAccount, minFillAmount, enablePartialFill, direction, ethBalance, stellarBalance]);

  const handleSwap = async () => {
    // Check wallet connections based on direction
    if (direction === "ETH_TO_XLM" && !ethConnected) {
      alert("Please connect your Ethereum wallet first");
      return;
    }
    if (direction === "XLM_TO_ETH" && !stellarConnected) {
      alert("Please connect your Stellar wallet first");
      return;
    }
    
    // Show warning for real transaction
    setShowRealTxWarning(true);
  };

  const handleEmergencyRecovery = async () => {
    if (!ethConnected) {
      alert("Please connect your Ethereum wallet first");
      return;
    }

    setIsRecovering(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      console.log('🆘 Starting emergency recovery for:', userAddress);
      
      const htlcContract = new SimpleHTLCContract(signer);
      const recentSwaps = await htlcContract.findRecentSwaps(userAddress);
      
      console.log(`🔍 Found ${recentSwaps.length} recent swaps`);
      
      if (recentSwaps.length === 0) {
        alert('No recent swaps found for your address.');
        return;
      }
      
      // Find refundable swaps
      const now = Math.floor(Date.now() / 1000);
      const refundableSwaps = recentSwaps.filter(swap => 
        !swap.details.withdrawn && 
        !swap.details.refunded && 
        now > swap.details.timelock
      );
      
      if (refundableSwaps.length === 0) {
        const activeSwaps = recentSwaps.filter(swap => 
          !swap.details.withdrawn && !swap.details.refunded
        );
        
        if (activeSwaps.length > 0) {
          const nextRefund = new Date(activeSwaps[0].details.timelock * 1000);
          alert(`Found ${activeSwaps.length} active swaps. Next refund available: ${nextRefund.toLocaleString()}`);
        } else {
          alert('No refundable swaps found. All swaps are already completed or refunded.');
        }
        return;
      }
      
      console.log(`💰 Found ${refundableSwaps.length} refundable swaps`);
      
      // Refund the first available swap
      const swapToRefund = refundableSwaps[0];
      console.log(`🔄 Refunding swap: ${swapToRefund.swapId.slice(0, 8)}... (${swapToRefund.details.amount} ETH)`);
      
      const refundTxHash = await htlcContract.refundSwap(swapToRefund.swapId);
      
      alert(`✅ Successfully refunded ${swapToRefund.details.amount} ETH!\nTransaction: ${refundTxHash}`);
      
    } catch (error: any) {
      console.error('Emergency recovery failed:', error);
      alert(`Recovery failed: ${error.message}`);
    } finally {
      setIsRecovering(false);
    }
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
                     ((direction === "ETH_TO_XLM" && ethConnected) || (direction === "XLM_TO_ETH" && stellarConnected)) &&
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
            disabled={((direction === "ETH_TO_XLM" && !ethConnected) || (direction === "XLM_TO_ETH" && !stellarConnected)) || progress > 0}
            className={errors.fromAmount ? "border-red-500 focus:ring-red-500" : ""}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
            {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}
          </div>
        </div>
        {((direction === "ETH_TO_XLM" && ethConnected) || (direction === "XLM_TO_ETH" && stellarConnected)) && (
          <div className="flex justify-between text-xs text-slate-400 mt-2">
            <span>Balance: {direction === "ETH_TO_XLM" ? parseFloat(ethBalance).toFixed(4) : parseFloat(stellarBalance).toFixed(4)} {direction === "ETH_TO_XLM" ? "ETH" : "XLM"}</span>
            <button
              onClick={() => {
                const balance = direction === "ETH_TO_XLM" ? ethBalance : stellarBalance;
                setFromAmount((parseFloat(balance) * 0.95).toFixed(6));
              }}
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
          disabled={((direction === "ETH_TO_XLM" && !ethConnected) || (direction === "XLM_TO_ETH" && !stellarConnected)) || progress > 0}
          className={errors.toAccount ? "border-red-500 focus:ring-red-500" : ""}
        />
        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
          <span>
            {direction === "ETH_TO_XLM" 
              ? "Enter Stellar wallet address to receive XLM (starts with G)" 
              : "Enter Ethereum wallet address to receive ETH (starts with 0x)"}
          </span>
          {direction === "ETH_TO_XLM" && stellarConnected && (
            <button
              onClick={() => {
                const stellarAddress = 'GDYQCPUX2W6GLVOCFAQLEVAPH7AVZ2M5E7WAFBEGNZL5ICUWDATPHT5Q'; // Get from stellar wallet context
                setToAccount(stellarAddress);
              }}
              className="text-brand hover:underline"
              disabled={progress > 0}
            >
              Use My Stellar Address
            </button>
          )}
          {direction === "XLM_TO_ETH" && ethConnected && (
            <button
              onClick={() => {
                const ethAddress = '0x322D58f69e8C06a1e6640e31a79e34AdcD8bf5CA'; // Get from eth wallet context
                setToAccount(ethAddress);
              }}
              className="text-brand hover:underline"
              disabled={progress > 0}
            >
              Use My ETH Address
            </button>
          )}
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
                disabled={((direction === "ETH_TO_XLM" && !ethConnected) || (direction === "XLM_TO_ETH" && !stellarConnected)) || progress > 0}
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
                disabled={((direction === "ETH_TO_XLM" && !ethConnected) || (direction === "XLM_TO_ETH" && !stellarConnected)) || progress > 0}
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

      {/* Estimated Receive with Gas Fee Calculation */}
      {fromAmount && (
        <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Estimated Receive:</span>
              <span className="text-white font-medium">
                {estimatedReceive} {direction === "ETH_TO_XLM" ? "XLM" : "ETH"}
              </span>
            </div>
            
            {/* Gas Fee Estimation */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">
                {direction === "ETH_TO_XLM" ? "Gas Fee (ETH):" : "Network Fee (XLM):"}
              </span>
              <span className="text-orange-300 font-medium">
                {direction === "ETH_TO_XLM" ? "~0.003 ETH" : "~0.00001 XLM"}
              </span>
            </div>
            
            {/* Total Cost */}
            <div className="flex justify-between text-sm border-t border-slate-600 pt-2">
              <span className="text-slate-300 font-medium">Total Cost:</span>
              <span className="text-white font-bold">
                {direction === "ETH_TO_XLM" 
                  ? `${(parseFloat(fromAmount) + 0.003).toFixed(6)} ETH`
                  : `${(parseFloat(fromAmount) + 0.00001).toFixed(7)} XLM`
                }
              </span>
            </div>
          </div>
          
          <div className="text-xs text-slate-400 mt-3">
            * Gas fees are estimates and may vary based on network congestion
          </div>
          
          {/* Clear explanation of swap direction */}
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="text-xs text-blue-200">
              {direction === "ETH_TO_XLM" ? (
                <>
                  <strong>🔄 Atomic Swap Process:</strong> Send {fromAmount} ETH via MetaMask → 
                  Secure HTLC locks funds → Automatic XLM delivery to {toAccount?.slice(0, 20)}...
                </>
              ) : (
                <>
                  <strong>🔄 Atomic Swap Process:</strong> Send {fromAmount} XLM via Freighter → 
                  Cross-chain bridge → Automatic ETH delivery to {toAccount?.slice(0, 20)}...
                </>
              )}
            </div>
          </div>
          
          {/* Security Notice */}
          <div className="mt-2 p-2 bg-green-900/20 border border-green-500/30 rounded">
            <div className="text-xs text-green-200">
              <strong>🔐 Security:</strong> 24-hour timelock protection • Atomic swap guarantees • 
              {direction === "ETH_TO_XLM" ? "HTLC smart contract" : "Cross-chain bridge"} safety
            </div>
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
        {(!ethConnected && !stellarConnected) ? "Connect Wallets" :
         (direction === "ETH_TO_XLM" && !ethConnected) ? "Connect MetaMask Wallet" :
         (direction === "XLM_TO_ETH" && !stellarConnected) ? "Connect Freighter Wallet" :
         isWrongNetwork ? "Switch to Sepolia Network" :
         progress > 0 ? "Processing Atomic Swap..." :
         direction === "ETH_TO_XLM" ? "Send" : "Send"}
      </Button>
      
      {/* Emergency Recovery Button */}
      {ethConnected && !isWrongNetwork && (
        <Button
          onClick={handleEmergencyRecovery}
          disabled={isRecovering}
          variant="outline"
          className="w-full mt-4 text-orange-400 border-orange-500 hover:bg-orange-900/20"
        >
          {isRecovering ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {isRecovering ? "Searching for Refundable Swaps..." : "🆘 Emergency Recovery (Find & Refund Failed Swaps)"}
        </Button>
      )}

      {/* Swap Progress */}
      <SwapProgress progress={progress} status={status} />

      {/* Swap Details */}
      <SwapDetails 
        swapState={swapState}
        onComplete={(swapId: string, secret: string) => {
          // Complete the swap with the provided secret
          completeSwap({
            swapId,
            direction,
            fromAmount,
            toAccount
          });
        }}
        onRefund={refundSwap}
        onReset={resetSwap}
      />
      
      {/* Enhanced Transaction Information */}
      {(ethConnected || stellarConnected) && !isWrongNetwork && swapState.status === 'idle' && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="text-sm text-red-100">
                <strong>⚠️ REAL CROSS-CHAIN TRANSACTIONS:</strong> This executes actual atomic swaps between 
                {direction === "ETH_TO_XLM" ? " Ethereum Sepolia testnet and Stellar testnet" : " Stellar testnet and Ethereum Sepolia testnet"}. 
                Verify your destination address carefully.
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-100">
                <strong>🔐 Atomic Swap Security:</strong> 
                {direction === "ETH_TO_XLM" ? (
                  <> Your ETH is locked in an HTLC smart contract with 24-hour timelock protection. 
                  Only pay gas fees (~0.003 ETH). Automatic refund if swap fails.</>
                ) : (
                  <> Your XLM is sent to bridge with cross-chain validation. 
                  ETH delivery confirmed via HTLC. Network fee ~0.00001 XLM.</>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-green-900/20 border border-green-500/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Coins className="w-5 h-5 text-green-400 mt-0.5" />
              <div className="text-sm text-green-100">
                <strong>✨ Automatic Process:</strong> After {direction === "ETH_TO_XLM" ? "MetaMask" : "Freighter"} confirmation, 
                the cross-chain swap executes automatically. No additional steps required from you.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}