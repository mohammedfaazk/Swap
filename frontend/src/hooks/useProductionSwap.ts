"use client";
import React, { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useSwapStore } from "@/store/swapStore";
import { useNotifications } from "@/components/ui/notification";
import type { SwapOrder } from "@/types/swap";

// Network configurations
export const NETWORK_CONFIGS = {
  ethereum: {
    mainnet: {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: 'https://mainnet.infura.io/v3/',
      explorerUrl: 'https://etherscan.io',
      contracts: {
        htlc: '0x...',
        bridge: '0x...',
      },
      gasMultiplier: 1.2,
      confirmations: 12,
    },
    sepolia: {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: 'https://sepolia.infura.io/v3/',
      explorerUrl: 'https://sepolia.etherscan.io',
      contracts: {
        htlc: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        bridge: '0x742D35Cc6639C19532DD5a7B0F0B8e1e74b74F61',
      },
      gasMultiplier: 1.5,
      confirmations: 3,
    },
    goerli: {
      chainId: 5,
      name: 'Goerli Testnet',
      rpcUrl: 'https://goerli.infura.io/v3/',
      explorerUrl: 'https://goerli.etherscan.io',
      contracts: {
        htlc: '0x...',
        bridge: '0x...',
      },
      gasMultiplier: 1.3,
      confirmations: 3,
    },
  },
  stellar: {
    mainnet: {
      networkPassphrase: StellarSdk.Networks.PUBLIC,
      horizonUrl: 'https://horizon.stellar.org',
      explorerUrl: 'https://stellar.expert/explorer/public',
      contractId: 'STELLAR_BRIDGE_MAINNET_CONTRACT_ID',
      baseFee: '10000',
      confirmations: 3,
    },
    testnet: {
      networkPassphrase: StellarSdk.Networks.TESTNET,
      horizonUrl: 'https://horizon-testnet.stellar.org',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
      contractId: 'STELLAR_BRIDGE_TESTNET_CONTRACT_ID',
      baseFee: '10000',
      confirmations: 1,
    },
  },
};

// Production swap configuration
const PRODUCTION_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  defaultTimelock: 24 * 3600, // 24 hours
  maxRetries: 3,
  retryDelay: 2000,
  conversionRate: 2500, // 1 ETH = 2500 XLM (dynamic in production)
  fees: {
    ethereum: 0.003, // ETH
    stellar: 0.00001, // XLM
    bridge: 0.003, // 0.3%
  },
  limits: {
    minAmount: 0.001,
    maxAmount: 1000,
    dailyLimit: 10000,
  },
};

export interface ProductionSwapState {
  id?: string;
  status: 'idle' | 'initializing' | 'pending' | 'validating' | 'executing' | 'completing' | 'completed' | 'failed' | 'refunded';
  progress: number;
  stage: string;
  transactionHashes: {
    ethereum?: string;
    stellar?: string;
    bridge?: string;
  };
  errorMessage?: string;
  timelock?: number;
  amount?: string;
  fromChain?: 'ethereum' | 'stellar';
  toChain?: 'ethereum' | 'stellar';
  fromNetwork?: string;
  toNetwork?: string;
  estimatedCompletionTime?: number;
  retryCount: number;
  securityChecks: {
    addressValidation: boolean;
    networkValidation: boolean;
    amountValidation: boolean;
    timelockValidation: boolean;
  };
}

interface NetworkStatus {
  ethereum: {
    connected: boolean;
    network: string;
    blockHeight?: number;
    gasPrice?: string;
  };
  stellar: {
    connected: boolean;
    network: string;
    ledger?: number;
    baseFee?: string;
  };
}

export function useProductionSwap() {
  const [swapState, setSwapState] = useState<ProductionSwapState>({
    status: 'idle',
    progress: 0,
    stage: 'Ready for production swap',
    transactionHashes: {},
    retryCount: 0,
    securityChecks: {
      addressValidation: false,
      networkValidation: false,
      amountValidation: false,
      timelockValidation: false,
    },
  });

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    ethereum: { connected: false, network: 'unknown' },
    stellar: { connected: false, network: 'unknown' },
  });

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const { addHistory } = useSwapStore();
  const { addNotification } = useNotifications();

  // WebSocket connection for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(PRODUCTION_CONFIG.wsUrl);
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected for real-time updates');
          setWsConnection(ws);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          setWsConnection(null);
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'swap_update' && data.swapId === swapState.id) {
      setSwapState(prev => ({
        ...prev,
        status: data.status,
        progress: data.progress,
        stage: data.stage,
        transactionHashes: { ...prev.transactionHashes, ...data.transactionHashes },
      }));
    }
  }, [swapState.id]);

  // Network monitoring
  useEffect(() => {
    const checkNetworkStatus = async () => {
      // Check Ethereum network
      try {
        if (window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          const feeData = await provider.getFeeData();
          const blockNumber = await provider.getBlockNumber();
          
          setNetworkStatus(prev => ({
            ...prev,
            ethereum: {
              connected: true,
              network: network.name,
              blockHeight: blockNumber,
              gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : undefined,
            },
          }));
        }
      } catch (error) {
        console.error('Failed to check Ethereum network:', error);
        setNetworkStatus(prev => ({
          ...prev,
          ethereum: { connected: false, network: 'unknown' },
        }));
      }

      // Check Stellar network
      try {
        const server = new StellarSdk.Horizon.Server(NETWORK_CONFIGS.stellar.testnet.horizonUrl);
        const ledger = await server.ledgers().order('desc').limit(1).call();
        
        setNetworkStatus(prev => ({
          ...prev,
          stellar: {
            connected: true,
            network: 'testnet',
            ledger: ledger.records[0].sequence,
            baseFee: StellarSdk.BASE_FEE,
          },
        }));
      } catch (error) {
        console.error('Failed to check Stellar network:', error);
        setNetworkStatus(prev => ({
          ...prev,
          stellar: { connected: false, network: 'unknown' },
        }));
      }
    };

    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const updateSwapState = useCallback((updates: Partial<ProductionSwapState>) => {
    setSwapState(prev => ({ ...prev, ...updates }));
  }, []);

  const performSecurityChecks = useCallback(async (order: SwapOrder): Promise<boolean> => {
    console.log('🔐 Performing security checks...');
    
    const checks = {
      addressValidation: false,
      networkValidation: false,
      amountValidation: false,
      timelockValidation: false,
    };

    try {
      // Address validation
      if (order.direction === 'ETH_TO_XLM') {
        // Validate Stellar address
        checks.addressValidation = order.toAccount?.startsWith('G') && order.toAccount.length === 56;
      } else {
        // Validate Ethereum address
        checks.addressValidation = ethers.isAddress(order.toAccount || '');
      }

      // Network validation
      checks.networkValidation = networkStatus.ethereum.connected && networkStatus.stellar.connected;

      // Amount validation
      const amount = parseFloat(order.fromAmount || '0');
      checks.amountValidation = amount >= PRODUCTION_CONFIG.limits.minAmount && 
                              amount <= PRODUCTION_CONFIG.limits.maxAmount;

      // Timelock validation
      const timelock = order.timelock || PRODUCTION_CONFIG.defaultTimelock;
      checks.timelockValidation = timelock >= 3600 && timelock <= 259200; // 1h to 72h

      updateSwapState({ securityChecks: checks });

      const allChecksPass = Object.values(checks).every(check => check);
      
      if (!allChecksPass) {
        const failedChecks = Object.entries(checks)
          .filter(([, passed]) => !passed)
          .map(([check]) => check);
        
        throw new Error(`Security checks failed: ${failedChecks.join(', ')}`);
      }

      console.log('✅ All security checks passed');
      return true;
    } catch (error) {
      console.error('❌ Security checks failed:', error);
      updateSwapState({ securityChecks: checks });
      throw error;
    }
  }, [networkStatus, updateSwapState]);

  const retryWithBackoff = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = PRODUCTION_CONFIG.maxRetries
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = PRODUCTION_CONFIG.retryDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        
        updateSwapState({ retryCount: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }, [updateSwapState]);

  const callProductionAPI = useCallback(async (endpoint: string, data: any) => {
    const response = await fetch(`${PRODUCTION_CONFIG.apiBaseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': '2.0',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API call failed');
    }

    return response.json();
  }, []);

  const estimateSwapTime = useCallback((order: SwapOrder): number => {
    const baseTime = 5 * 60 * 1000; // 5 minutes base
    const networkDelays = {
      ethereum: networkStatus.ethereum.blockHeight ? 15000 : 60000, // 15s if connected, 1m if not
      stellar: networkStatus.stellar.ledger ? 5000 : 30000, // 5s if connected, 30s if not
    };
    
    const totalDelay = networkDelays.ethereum + networkDelays.stellar;
    const complexityMultiplier = order.partial ? 1.5 : 1.0;
    
    return baseTime + totalDelay * complexityMultiplier;
  }, [networkStatus]);

  const initiateProductionSwap = useCallback(async (order: SwapOrder) => {
    try {
      updateSwapState({
        status: 'initializing',
        progress: 5,
        stage: 'Initializing production swap...',
        fromChain: order.direction === 'ETH_TO_XLM' ? 'ethereum' : 'stellar',
        toChain: order.direction === 'ETH_TO_XLM' ? 'stellar' : 'ethereum',
        amount: order.fromAmount,
        retryCount: 0,
      });

      // Security checks
      await performSecurityChecks(order);
      
      updateSwapState({
        progress: 15,
        stage: 'Security checks completed. Initiating swap...',
      });

      // Estimate completion time
      const estimatedTime = estimateSwapTime(order);
      updateSwapState({ estimatedCompletionTime: Date.now() + estimatedTime });

      // Call production API
      const swapRequest = {
        fromChain: order.direction === 'ETH_TO_XLM' ? 'ethereum' : 'stellar',
        toChain: order.direction === 'ETH_TO_XLM' ? 'stellar' : 'ethereum',
        amount: order.fromAmount,
        destinationAddress: order.toAccount,
        token: order.direction === 'ETH_TO_XLM' ? 'ETH' : 'XLM',
        timelock: order.timelock || PRODUCTION_CONFIG.defaultTimelock,
        partialFillEnabled: order.partial || false,
        fromNetwork: order.direction === 'ETH_TO_XLM' ? 'sepolia' : 'testnet',
        toNetwork: order.direction === 'ETH_TO_XLM' ? 'testnet' : 'sepolia',
      };

      const response = await retryWithBackoff(() => 
        callProductionAPI('/api/v2/swaps', swapRequest)
      );

      updateSwapState({
        id: response.swapId,
        status: 'pending',
        progress: 30,
        stage: 'Swap initiated. Waiting for network confirmations...',
      });

      // Subscribe to real-time updates via WebSocket
      if (wsConnection) {
        wsConnection.send(JSON.stringify({
          type: 'subscribe',
          swapId: response.swapId,
        }));
      }

      // Start polling for status updates as fallback
      const pollForUpdates = async () => {
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes with 5-second intervals
        
        while (attempts < maxAttempts && swapState.status !== 'completed' && swapState.status !== 'failed') {
          try {
            const statusResponse = await fetch(
              `${PRODUCTION_CONFIG.apiBaseUrl}/api/v2/swaps/${response.swapId}`
            );
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              const swap = statusData.swap;
              
              updateSwapState({
                status: swap.status,
                progress: swap.progress || 50,
                stage: `Status: ${swap.status}`,
                transactionHashes: {
                  ...swapState.transactionHashes,
                  ...swap.transactions,
                },
              });
              
              if (swap.status === 'completed') {
                updateSwapState({
                  progress: 100,
                  stage: 'Cross-chain atomic swap completed successfully!',
                });
                
                addNotification({
                  type: 'success',
                  title: `${order.direction.replace('_', ' → ')} Swap Completed! 🎉`,
                  message: `Successfully swapped ${order.fromAmount} via production bridge`,
                  persistent: true,
                });
                
                addHistory({
                  ...order,
                  timestamp: Date.now(),
                  txHash: swap.transactions?.ethereum || swap.transactions?.stellar,
                  swapId: response.swapId,
                });
                
                break;
              } else if (swap.status === 'failed') {
                throw new Error('Swap failed on the backend');
              }
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            console.error('Status polling error:', error);
            attempts++;
          }
        }
        
        if (attempts >= maxAttempts) {
          throw new Error('Swap timeout - please check transaction status manually');
        }
      };

      await pollForUpdates();

    } catch (error: any) {
      console.error('Production swap failed:', error);
      
      updateSwapState({
        status: 'failed',
        errorMessage: error.message,
        stage: `Swap failed: ${error.message}`,
      });

      addNotification({
        type: 'error',
        title: 'Production Swap Failed',
        message: `Failed: ${error.message}`,
        persistent: true,
      });
    }
  }, [
    performSecurityChecks,
    estimateSwapTime,
    retryWithBackoff,
    callProductionAPI,
    wsConnection,
    swapState,
    updateSwapState,
    addNotification,
    addHistory,
  ]);

  const getSwapFees = useCallback((direction: 'ETH_TO_XLM' | 'XLM_TO_ETH', amount: string) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return { networkFee: '0', bridgeFee: '0', total: '0' };

    const networkFee = direction === 'ETH_TO_XLM' 
      ? PRODUCTION_CONFIG.fees.ethereum 
      : PRODUCTION_CONFIG.fees.stellar;
    
    const bridgeFee = numAmount * PRODUCTION_CONFIG.fees.bridge;
    const total = networkFee + bridgeFee;

    return {
      networkFee: networkFee.toFixed(6),
      bridgeFee: bridgeFee.toFixed(6),
      total: total.toFixed(6),
    };
  }, []);

  const resetSwap = useCallback(() => {
    setSwapState({
      status: 'idle',
      progress: 0,
      stage: 'Ready for production swap',
      transactionHashes: {},
      retryCount: 0,
      securityChecks: {
        addressValidation: false,
        networkValidation: false,
        amountValidation: false,
        timelockValidation: false,
      },
    });
  }, []);

  const getNetworkInfo = useCallback(() => {
    return {
      ethereum: {
        ...networkStatus.ethereum,
        config: NETWORK_CONFIGS.ethereum.sepolia,
      },
      stellar: {
        ...networkStatus.stellar,
        config: NETWORK_CONFIGS.stellar.testnet,
      },
    };
  }, [networkStatus]);

  return {
    swapState,
    networkStatus,
    initiateSwap: initiateProductionSwap,
    getSwapFees,
    resetSwap,
    getNetworkInfo,
    isSwapping: swapState.status !== 'idle',
    isConnected: networkStatus.ethereum.connected && networkStatus.stellar.connected,
    supportedNetworks: NETWORK_CONFIGS,
    productionConfig: PRODUCTION_CONFIG,
  };
}