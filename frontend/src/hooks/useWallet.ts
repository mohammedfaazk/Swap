"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string;
  chainId: number | null;
  error: string | null;
  isLoading: boolean;
}

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: "0.0",
    chainId: null,
    error: null,
    isLoading: true,
  });

  const updateError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const updateLoading = (isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  };

  const checkConnection = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: "MetaMask not installed" 
      }));
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      const network = await provider.getNetwork();

      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);

        setState({
          isConnected: true,
          address,
          balance: ethers.formatEther(balance),
          chainId: Number(network.chainId),
          error: null,
          isLoading: false,
        });
      } else {
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          address: null,
          balance: "0.0",
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error("Error checking connection:", error);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to check wallet connection",
        isLoading: false 
      }));
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      updateError("Please install MetaMask");
      return;
    }

    updateLoading(true);
    updateError(null);

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      // Switch to or add Sepolia network
      await switchToSepolia();
      
      // Recheck connection after switching
      await checkConnection();
    } catch (error: any) {
      console.error("Connection error:", error);
      if (error.code === 4001) {
        updateError("Please approve the connection in MetaMask");
      } else if (error.code === -32002) {
        updateError("Connection request already pending. Please check MetaMask");
      } else {
        updateError(error.message || "Failed to connect wallet");
      }
      updateLoading(false);
    }
  };

  const switchToSepolia = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain not added, add it
        try {
          await window.ethereum.request({
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
        } catch (addError) {
          throw new Error("Failed to add Sepolia network");
        }
      } else {
        throw error;
      }
    }
  };

  const disconnectWallet = () => {
    setState({
      isConnected: false,
      address: null,
      balance: "0.0",
      chainId: null,
      error: null,
      isLoading: false,
    });
  };

  const refreshBalance = useCallback(async () => {
    if (!state.isConnected || !state.address || !window.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(state.address);
      setState(prev => ({ ...prev, balance: ethers.formatEther(balance) }));
    } catch (error) {
      console.error("Error refreshing balance:", error);
    }
  }, [state.isConnected, state.address]);

  // Setup event listeners
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        checkConnection();
      }
    };

    const handleChainChanged = () => {
      checkConnection();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Initial check
    checkConnection();

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [checkConnection]);

  return {
    ...state,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    isWrongNetwork: state.chainId !== null && state.chainId !== SEPOLIA_CHAIN_ID,
    switchToSepolia,
  };
}

declare global {
  interface Window {
    ethereum?: any;
  }
}