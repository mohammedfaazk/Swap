"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { useMultiWallet } from './WalletProvider';
import { Wallet, ExternalLink, X } from 'lucide-react';

interface WalletOption {
  name: string;
  type: 'metamask' | 'coinbase' | 'walletconnect';
  icon: string;
  description: string;
  installUrl?: string;
  isAvailable: boolean;
}

export function WalletSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { connectWallet, isLoading, error } = useMultiWallet();

  const walletOptions: WalletOption[] = [
    {
      name: 'MetaMask',
      type: 'metamask',
      icon: '🦊',
      description: 'Connect using MetaMask browser extension',
      installUrl: 'https://metamask.io/download/',
      isAvailable: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
    },
    {
      name: 'Coinbase Wallet',
      type: 'coinbase',
      icon: '🔵',
      description: 'Connect using Coinbase Wallet extension',
      installUrl: 'https://www.coinbase.com/wallet',
      isAvailable: typeof window !== 'undefined' && (!!window.ethereum?.isCoinbaseWallet || !!window.coinbaseWalletExtension),
    },
    {
      name: 'WalletConnect',
      type: 'walletconnect',
      icon: '🔗',
      description: 'Connect using mobile wallet via QR code',
      isAvailable: true, // Always show as available
    },
  ];

  const handleConnect = async (walletType: 'metamask' | 'coinbase' | 'walletconnect') => {
    try {
      await connectWallet(walletType);
      setIsOpen(false);
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="bg-brand hover:bg-brand/90"
        size="lg"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
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
                        →
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
                <div className="text-red-100 text-sm">{error}</div>
              </div>
            )}

            <div className="mt-6 text-xs text-slate-400 text-center">
              By connecting a wallet, you agree to the{' '}
              <span className="text-brand">Terms of Service</span> and{' '}
              <span className="text-brand">Privacy Policy</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}