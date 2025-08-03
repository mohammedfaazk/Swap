"use client";

import { UnifiedWalletConnection } from "@/components/wallet/UnifiedWalletConnection";
import { SwapInterface } from "@/components/swap/SwapInterface";
import { SwapHistory } from "@/components/swap/SwapHistory";
import { SwapDetails } from "@/components/swap/SwapDetails";
import { useSwap } from "@/hooks/useSwap";
import { ArrowLeftRight, Shield, Zap, Globe } from "lucide-react";

export default function Home() {
  const { swapState, completeSwap, refundSwap, resetSwap } = useSwap();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 bg-brand/20 rounded-full mr-4">
              <ArrowLeftRight className="w-8 h-8 text-brand" />
            </div>
            <h1 className="text-5xl font-bold text-white">
              StellarBridge <span className="text-brand">Fusion+</span>
            </h1>
          </div>
          
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            Professional cross-chain atomic swaps between Ethereum and Stellar networks. 
            Secure, fast, and decentralized trading with partial fill support.
          </p>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
              <Shield className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Atomic Swaps</h3>
              <p className="text-sm text-slate-400">
                Trustless exchanges with cryptographic guarantees. Your funds are always secure.
              </p>
            </div>
            
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
              <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Partial Fills</h3>
              <p className="text-sm text-slate-400">
                Large orders can be filled by multiple resolvers for better liquidity.
              </p>
            </div>
            
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
              <Globe className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Cross-Chain</h3>
              <p className="text-sm text-slate-400">
                Seamlessly trade between Ethereum Sepolia and Stellar testnet.
              </p>
            </div>
          </div>
        </div>

        {/* Wallet Connections */}
        <div className="mb-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallets</h2>
            <p className="text-slate-400">Connect both Ethereum and Stellar wallets to start swapping</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <UnifiedWalletConnection />
          </div>
        </div>

        {/* Main Trading Interface */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Swap Interface - Takes up 2 columns */}
          <div className="xl:col-span-2 space-y-8">
            <SwapInterface />
            
            {/* Show swap details if there's an active swap */}
            {swapState.status !== 'idle' && (
              <SwapDetails 
                swapState={swapState}
                onComplete={(swapId: string, secret: string) => {
                  // This is handled automatically by the swap system
                  console.log('Swap completion requested:', { swapId, secret });
                }}
                onRefund={(swapId: string) => {
                  console.log('Refund requested for swap:', swapId);
                  // Refund functionality would be implemented here
                }}
                onReset={resetSwap}
              />
            )}
          </div>
          
          {/* Swap History - Takes up 1 column */}
          <div className="xl:col-span-1">
            <SwapHistory />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-6 border border-slate-700 max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-white mb-3">Testnet Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
              <div>
                <p className="mb-2">
                  <strong className="text-slate-300">Ethereum:</strong> Sepolia Testnet
                </p>
                <p>Get test ETH from <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Sepolia Faucet</a></p>
              </div>
              <div>
                <p className="mb-2">
                  <strong className="text-slate-300">Stellar:</strong> Testnet
                </p>
                <p>Test XLM automatically funded via Friendbot</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}