"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string;
  chainId: number | null;
  walletType: 'metamask' | 'coinbase' | 'walletconnect' | null;
  provider: ethers.BrowserProvider | null;
}

interface WalletContextType extends WalletState {
  connectWallet: (walletType: 'metamask' | 'coinbase' | 'walletconnect') => Promise<void>;
  disconnectWallet: () => void;
  switchAccount: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  switchToSepolia: () => Promise<void>;
  isWrongNetwork: boolean;
  error: string | null;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useMultiWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useMultiWallet must be used within WalletProvider');
  }
  return context;
}

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

interface WalletOption {
  name: string;
  type: 'metamask' | 'coinbase' | 'walletconnect';
  icon: string;
  isAvailable: () => boolean;
  getProvider: () => any;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: "0.0",
    chainId: null,
    walletType: null,
    provider: null,
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getAvailableWallets = (): WalletOption[] => {
    return [
      {
        name: 'MetaMask',
        type: 'metamask',
        icon: '🦊',
        isAvailable: () => typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
        getProvider: () => window.ethereum,
      },
      {
        name: 'Coinbase Wallet',
        type: 'coinbase',
        icon: '🔵',
        isAvailable: () => typeof window !== 'undefined' && (!!window.ethereum?.isCoinbaseWallet || !!window.coinbaseWalletExtension),
        getProvider: () => window.ethereum?.isCoinbaseWallet ? window.ethereum : window.coinbaseWalletExtension,
      },
      {
        name: 'WalletConnect',
        type: 'walletconnect',
        icon: '🔗',
        isAvailable: () => true, // Always available as it works through QR
        getProvider: () => null, // Will implement WalletConnect separately
      },
    ];
  };

  // Keep function available for future use
  console.log(getAvailableWallets);

  const connectWallet = async (walletType: 'metamask' | 'coinbase' | 'walletconnect') => {
    setIsLoading(true);
    setError(null);

    try {
      let provider: any;
      
      if (walletType === 'metamask') {
        if (!window.ethereum?.isMetaMask) {
          throw new Error('MetaMask not found. Please install MetaMask extension.');
        }
        provider = window.ethereum;
      } else if (walletType === 'coinbase') {
        provider = window.ethereum?.isCoinbaseWallet ? window.ethereum : window.coinbaseWalletExtension;
        if (!provider) {
          throw new Error('Coinbase Wallet not found. Please install Coinbase Wallet extension.');
        }
      } else if (walletType === 'walletconnect') {
        // For now, fallback to MetaMask if WalletConnect not implemented
        if (window.ethereum) {
          provider = window.ethereum;
          walletType = 'metamask';
        } else {
          throw new Error('No wallet found. Please install a Web3 wallet.');
        }
      }

      // Request account access
      await provider.request({ method: "eth_requestAccounts" });

      // Create ethers provider
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      const balance = await ethersProvider.getBalance(address);
      const network = await ethersProvider.getNetwork();

      setState({
        isConnected: true,
        address,
        balance: ethers.formatEther(balance),
        chainId: Number(network.chainId),
        walletType,
        provider: ethersProvider,
      });

      // Auto-switch to Sepolia if on wrong network
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        await switchToSepolia();
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setState({
      isConnected: false,
      address: null,
      balance: "0.0",
      chainId: null,
      walletType: null,
      provider: null,
    });
    setError(null);
  };

  const switchAccount = async () => {
    if (!state.provider) return;

    try {
      setIsLoading(true);
      const provider = state.provider.provider as any;
      
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      });

      // Refresh connection after account change
      const signer = await state.provider.getSigner();
      const address = await signer.getAddress();
      const balance = await state.provider.getBalance(address);

      setState(prev => ({
        ...prev,
        address,
        balance: ethers.formatEther(balance),
      }));

      setIsLoading(false);
    } catch (err: any) {
      console.error('Account switch error:', err);
      setError('Failed to switch account');
      setIsLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (!state.isConnected || !state.address || !state.provider) return;

    try {
      const balance = await state.provider.getBalance(state.address);
      setState(prev => ({ ...prev, balance: ethers.formatEther(balance) }));
    } catch (err) {
      console.error('Error refreshing balance:', err);
    }
  };

  const switchToSepolia = async () => {
    if (!state.provider) return;

    try {
      const provider = state.provider.provider as any;
      
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (err: any) {
      if (err.code === 4902) {
        // Chain not added, add it
        try {
          const provider = state.provider.provider as any;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Sepolia Test Network",
              nativeCurrency: {
                name: "Sepolia ETH",
                symbol: "SepoliaETH",
                decimals: 18,
              },
              rpcUrls: ["https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"],
              blockExplorerUrls: ["https://sepolia.etherscan.io/"],
            }],
          });
        } catch (_addError) {
          throw new Error("Failed to add Sepolia network");
        }
      } else {
        throw err;
      }
    }
  };

  // Setup event listeners
  useEffect(() => {
    if (!state.provider || typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        // Refresh connection
        if (state.walletType) {
          connectWallet(state.walletType);
        }
      }
    };

    const handleChainChanged = (chainId: string) => {
      console.log('Chain changed:', chainId);
      // Refresh connection after chain change
      if (state.walletType) {
        connectWallet(state.walletType);
      }
    };

    // Use window.ethereum directly for event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.provider, state.walletType]);

  return (
    <WalletContext.Provider value={{
      ...state,
      connectWallet,
      disconnectWallet,
      switchAccount,
      refreshBalance,
      switchToSepolia,
      isWrongNetwork: state.chainId !== null && state.chainId !== SEPOLIA_CHAIN_ID,
      error,
      isLoading,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

// Extend window interface
declare global {
  interface Window {
    ethereum?: any;
    coinbaseWalletExtension?: any;
  }
}