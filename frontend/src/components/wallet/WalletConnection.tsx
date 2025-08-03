"use client";

import { useMultiWallet } from "./WalletProvider";
import { WalletSelector } from "./WalletSelector";
import { Button } from "../ui/button";
import { AlertCircle, CheckCircle, ExternalLink, RefreshCw, Wallet } from "lucide-react";

export function WalletConnection() {
  const { 
    isConnected, 
    address, 
    balance, 
    error, 
    isLoading,
    isWrongNetwork,
    walletType,
    disconnectWallet,
    switchAccount,
    refreshBalance,
    switchToSepolia
  } = useMultiWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    return num.toFixed(4);
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl border border-slate-600 shadow-lg">
        <div className="flex items-center justify-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-brand" />
          <span className="text-white">Checking wallet connection...</span>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl border border-slate-600 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wallet className="w-6 h-6 text-slate-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Connect Wallet</h3>
              <p className="text-sm text-slate-300">Choose your preferred wallet to start trading</p>
            </div>
          </div>
          <WalletSelector />
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-100 text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="p-6 bg-gradient-to-r from-amber-900/50 to-orange-900/50 rounded-xl border border-amber-500/50 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Wrong Network</h3>
              <p className="text-sm text-amber-100">Please switch to Sepolia testnet</p>
              {address && (
                <p className="text-xs text-slate-300 mt-1">
                  Connected: {formatAddress(address)}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Button 
              onClick={switchToSepolia}
              className="bg-amber-600 hover:bg-amber-700 text-white block"
            >
              Switch to Sepolia
            </Button>
            <Button 
              onClick={disconnectWallet}
              variant="outline"
              size="sm"
              className="text-slate-300 border-slate-600 hover:bg-slate-700 w-full"
            >
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-500/50 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">
              {walletType === 'metamask' ? '🦊 MetaMask' : 
               walletType === 'coinbase' ? '🔵 Coinbase' : 
               walletType === 'walletconnect' ? '🔗 WalletConnect' : 'Wallet'} Connected
            </h3>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-sm text-green-100">
                {formatAddress(address!)}
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">
                  {formatBalance(balance)} SepoliaETH
                </span>
                <button
                  onClick={refreshBalance}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Refresh balance"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Sepolia Testnet • {walletType?.charAt(0).toUpperCase()}{walletType?.slice(1)} Wallet</p>
          </div>
        </div>
        <div className="space-y-2">
          <Button 
            onClick={() => window.open(`https://sepolia.etherscan.io/address/${address}`, "_blank")}
            variant="outline"
            size="sm"
            className="text-slate-300 border-slate-600 hover:bg-slate-700"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View on Explorer
          </Button>
          <Button 
            onClick={switchAccount}
            variant="outline" 
            size="sm"
            className="text-slate-300 border-slate-600 hover:bg-slate-700 w-full"
          >
            <Wallet className="w-3 h-3 mr-1" />
            Switch Account
          </Button>
          <Button 
            onClick={disconnectWallet}
            variant="outline" 
            size="sm"
            className="text-red-300 border-red-600 hover:bg-red-900/50 w-full"
          >
            Disconnect & Choose Wallet
          </Button>
        </div>
      </div>
    </div>
  );
}