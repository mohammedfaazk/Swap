"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { useStellarWallet } from './StellarWalletProvider';
import { Star, ExternalLink, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface StellarWalletOption {
  name: string;
  type: 'freighter' | 'demo';
  icon: string;
  description: string;
  installUrl?: string;
  isAvailable: boolean;
}

export function StellarWalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { connectWallet, isLoading, error } = useStellarWallet();

  const walletOptions: StellarWalletOption[] = [
    {
      name: 'Freighter',
      type: 'freighter',
      icon: '🚀',
      description: 'Official Stellar wallet extension (Recommended)',
      installUrl: 'https://freighter.app/',
      isAvailable: true, // Always show as available, we'll check during connection
    },
    {
      name: 'Demo Wallet',
      type: 'demo',
      icon: '🎭',
      description: 'Generate test wallet (Development only)',
      isAvailable: true,
    },
  ];

  const handleConnect = async (walletType: 'freighter' | 'demo') => {
    try {
      await connectWallet(walletType);
      setIsOpen(false);
    } catch (err) {
      console.error('Stellar connection failed:', err);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="bg-purple-600 hover:bg-purple-700 text-white"
        size="lg"
      >
        <Star className="w-4 h-4 mr-2" />
        Connect Stellar Wallet
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Connect Stellar Wallet</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {walletOptions.map((wallet) => (
                <div key={wallet.type}>
                  {wallet.isAvailable ? (
                    <button
                      onClick={() => handleConnect(wallet.type)}
                      disabled={isLoading}
                      className="w-full p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors flex items-center justify-between group disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{wallet.icon}</span>
                        <div className="text-left">
                          <div className="text-white font-medium">{wallet.name}</div>
                          <div className="text-slate-400 text-sm">{wallet.description}</div>
                        </div>
                      </div>
                      <div className="text-slate-400 group-hover:text-white transition-colors">
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '→'}
                      </div>
                    </button>
                  ) : (
                    <div className="w-full p-4 bg-slate-700/30 border border-slate-600 rounded-lg opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl grayscale">{wallet.icon}</span>
                          <div className="text-left">
                            <div className="text-slate-300 font-medium">{wallet.name}</div>
                            <div className="text-slate-500 text-sm">Not installed</div>
                          </div>
                        </div>
                        {wallet.installUrl && (
                          <Button
                            onClick={() => window.open(wallet.installUrl, '_blank')}
                            variant="outline"
                            size="sm"
                            className="text-slate-300 border-slate-500 hover:bg-slate-600"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Install
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <div className="text-red-100 text-sm">{error}</div>
                </div>
              </div>
            )}

            <div className="mt-6 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <div className="text-blue-100 text-sm">
                  <strong>Testnet Mode:</strong> Using Stellar testnet for safe testing
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function StellarWalletStatus() {
  const { 
    isConnected, 
    publicKey, 
    balance, 
    walletType, 
    disconnectWallet, 
    refreshBalance,
    error 
  } = useStellarWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    return num.toFixed(4);
  };

  if (!isConnected) {
    return <StellarWalletSelector />;
  }

  return (
    <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/50 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">
              {walletType === 'freighter' ? '🚀 Freighter' : '🎭 Demo'} Connected
            </h3>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-sm text-purple-100">
                {formatAddress(publicKey!)}
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">
                  {formatBalance(balance)} XLM
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
            <p className="text-xs text-slate-400 mt-1">Stellar Testnet • {walletType?.charAt(0).toUpperCase()}{walletType?.slice(1)} Wallet</p>
          </div>
        </div>
        <div className="space-y-2">
          <Button 
            onClick={() => window.open(`https://stellar.expert/explorer/testnet/account/${publicKey}`, '_blank')}
            variant="outline"
            size="sm"
            className="text-slate-300 border-slate-600 hover:bg-slate-700"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View on Explorer
          </Button>
          <Button 
            onClick={disconnectWallet}
            variant="outline" 
            size="sm"
            className="text-red-300 border-red-600 hover:bg-red-900/50 w-full"
          >
            Disconnect
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-3 p-2 bg-red-900/50 border border-red-500/50 rounded">
          <div className="text-red-100 text-sm">{error}</div>
        </div>
      )}
    </div>
  );
}