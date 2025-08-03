"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  isConnected, 
  getAddress, 
  signTransaction,
  requestAccess,
  getNetwork 
} from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface StellarWalletState {
  isConnected: boolean;
  publicKey: string | null;
  balance: string;
  network: string | null;
  walletType: 'freighter' | 'demo' | null;
}

interface StellarWalletContextType extends StellarWalletState {
  connectWallet: (walletType: 'freighter' | 'demo') => Promise<void>;
  disconnectWallet: () => void;
  signAndSubmitTx: (transaction: StellarSdk.Transaction) => Promise<string>;
  refreshBalance: () => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

const StellarWalletContext = createContext<StellarWalletContextType | null>(null);

export function useStellarWallet() {
  const context = useContext(StellarWalletContext);
  if (!context) {
    throw new Error('useStellarWallet must be used within StellarWalletProvider');
  }
  return context;
}

export function StellarWalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StellarWalletState>({
    isConnected: false,
    publicKey: null,
    balance: "0.0",
    network: null,
    walletType: null,
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Stellar server for testnet
  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

  const connectWallet = async (walletType: 'freighter' | 'demo') => {
    setIsLoading(true);
    setError(null);

    try {
      let publicKey: string;

      if (walletType === 'freighter') {
        try {
          console.log('🚀 Starting Freighter connection...');
          
          // Always request access to ensure user permissions
          console.log('🔐 Requesting Freighter access...');
          const accessResult = await requestAccess();
          console.log('🔐 Access result:', accessResult);
          
          if (accessResult.error) {
            throw new Error('Freighter wallet access denied. Please allow access and try again.');
          }
          
          // Check connection status
          const connected = await isConnected();
          console.log('🔗 Connection status:', connected);

          // Get public key
          const addressResult = await getAddress();
          console.log('🔑 Freighter Address Result:', addressResult);
          if (addressResult.error) {
            throw new Error(addressResult.error.message || 'Failed to get address from Freighter');
          }
          publicKey = addressResult.address;
          console.log('✅ Connected to Freighter account:', publicKey);
          
          // Get network (should be TESTNET for our demo)
          const network = await getNetwork();
          console.log('🌟 Freighter Network:', network);

          if (network.error) {
            throw new Error('Failed to get network from Freighter');
          }

          if (network.network !== 'TESTNET') {
            throw new Error('Please switch Freighter to Testnet. Go to Freighter settings → Network → Testnet');
          }
        } catch (apiError: any) {
          if (apiError.message?.includes('not installed') || apiError.code === 'NOT_INSTALLED') {
            throw new Error('Freighter wallet not found. Please install Freighter extension from https://freighter.app/');
          }
          throw apiError;
        }

      } else if (walletType === 'demo') {
        // Generate demo wallet
        console.log('🎭 Generating demo Stellar wallet...');
        const demoKeypair = StellarSdk.Keypair.random();
        publicKey = demoKeypair.publicKey();
        console.log('✅ Generated demo account:', publicKey);
        
        // Fund demo account via Friendbot
        try {
          console.log('💰 Funding demo account via Friendbot...');
          const fundResponse = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
          if (fundResponse.ok) {
            console.log('✅ Demo account funded successfully');
          } else {
            console.warn('⚠️ Friendbot funding failed, but continuing...');
          }
        } catch (fundError) {
          console.warn('⚠️ Friendbot error, but continuing:', fundError);
        }
        
      } else {
        throw new Error('Unsupported wallet type');
      }

      // Get account balance
      let balance = "0.0";
      try {
        const account = await server.loadAccount(publicKey);
        const xlmBalance = account.balances.find(b => b.asset_type === 'native');
        balance = xlmBalance ? xlmBalance.balance : "0.0";
      } catch (balanceError) {
        console.warn('Could not load balance, account might not exist yet:', balanceError);
      }

      setState({
        isConnected: true,
        publicKey,
        balance,
        network: 'TESTNET',
        walletType,
      });

      setIsLoading(false);
    } catch (err: any) {
      console.error('Stellar wallet connection error:', err);
      setError(err.message || 'Failed to connect Stellar wallet');
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setState({
      isConnected: false,
      publicKey: null,
      balance: "0.0",
      network: null,
      walletType: null,
    });
    setError(null);
  };

  const signAndSubmitTx = async (transaction: StellarSdk.Transaction): Promise<string> => {
    if (!state.isConnected || !state.publicKey) {
      throw new Error('Stellar wallet not connected');
    }

    try {
      if (state.walletType === 'freighter') {
        // Sign with Freighter
        const signedResult = await signTransaction(transaction.toXDR(), {
          networkPassphrase: StellarSdk.Networks.TESTNET,
        });

        if (signedResult.error) {
          throw new Error(signedResult.error.message || 'Failed to sign transaction');
        }

        // Submit to network
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedResult.signedTxXdr, StellarSdk.Networks.TESTNET);
        const result = await server.submitTransaction(signedTx);
        
        return result.hash;
      } else {
        throw new Error('Only Freighter wallet is supported for signing');
      }
    } catch (err: any) {
      console.error('Transaction signing failed:', err);
      throw new Error(`Failed to sign transaction: ${err.message}`);
    }
  };

  const refreshBalance = async () => {
    if (!state.isConnected || !state.publicKey) return;

    try {
      const account = await server.loadAccount(state.publicKey);
      const xlmBalance = account.balances.find(b => b.asset_type === 'native');
      const balance = xlmBalance ? xlmBalance.balance : "0.0";
      
      setState(prev => ({ ...prev, balance }));
    } catch (err) {
      console.error('Error refreshing Stellar balance:', err);
    }
  };

  // Removed automatic connection - user must manually connect

  return (
    <StellarWalletContext.Provider value={{
      ...state,
      connectWallet,
      disconnectWallet,
      signAndSubmitTx,
      refreshBalance,
      error,
      isLoading,
    }}>
      {children}
    </StellarWalletContext.Provider>
  );
}

// Extend window interface for Freighter
declare global {
  interface Window {
    freighterApi?: any;
  }
}