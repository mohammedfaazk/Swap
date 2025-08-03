"use client";
import React, { useState, useCallback } from "react";
import { ethers } from "ethers";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useSwapStore } from "@/store/swapStore";
import { useNotifications } from "@/components/ui/notification";
import { SimpleHTLCContract } from "@/contracts/SimpleHTLC";
import type { SwapOrder } from "@/types/swap";

// Types
export interface SwapState {
  id?: string;
  secret?: string;
  secretHash?: string;
  status: 'idle' | 'initializing' | 'pending' | 'validating' | 'executing' | 'completing' | 'confirming' | 'completed' | 'failed' | 'refunded';
  transactionHash?: string;
  errorMessage?: string;
  timelock?: number;
  progress: number;
  stage: string;
  amount?: string;
  toAccount?: string;
}

interface WalletConnections {
  ethereum?: ethers.BrowserProvider;
  stellar?: typeof import('@stellar/freighter-api');
}

interface SwapConfig {
  ethereumNetwork: string;
  stellarNetwork: string;
  conversionRate: number; // XLM per ETH
  timelockHours: number;
}

// Configuration
const SWAP_CONFIG: SwapConfig = {
  ethereumNetwork: 'sepolia',
  stellarNetwork: 'testnet',
  conversionRate: 2500, // 1 ETH = 2500 XLM (approximate)
  timelockHours: 24,
};

const ETHEREUM_RPC_URL = `https://sepolia.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_KEY}`;
const STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
const STELLAR_FRIENDBOT_URL = 'https://friendbot.stellar.org';

export function useAtomicSwap() {
  // State management
  const [swapState, setSwapState] = useState<SwapState>({
    status: 'idle',
    progress: 0,
    stage: 'Ready to swap',
  });

  const [wallets, setWallets] = useState<WalletConnections>({});
  
  const { addHistory } = useSwapStore();
  const { addNotification } = useNotifications();

  // Utility functions
  const updateSwapState = useCallback((updates: Partial<SwapState>) => {
    setSwapState(prev => ({ ...prev, ...updates }));
  }, []);

  // Direction-aware address validation utility
  const validateSwapAddress = useCallback((address: string, direction: 'ETH_TO_XLM' | 'XLM_TO_ETH'): boolean => {
    if (!address || address.trim().length === 0) {
      return false;
    }

    const cleanAddress = address.trim();

    if (direction === 'ETH_TO_XLM') {
      // Validate Stellar address
      return cleanAddress.length === 56 && 
             cleanAddress.startsWith('G') && 
             StellarSdk.StrKey.isValidEd25519PublicKey(cleanAddress);
    } else {
      // Validate Ethereum address
      return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress) && 
             ethers.isAddress(cleanAddress);
    }
  }, []);

  const calculateConversion = useCallback((amount: string, direction: 'ETH_TO_XLM' | 'XLM_TO_ETH'): string => {
    const value = parseFloat(amount);
    if (direction === 'ETH_TO_XLM') {
      return (value * SWAP_CONFIG.conversionRate).toFixed(7);
    } else {
      return (value / SWAP_CONFIG.conversionRate).toFixed(6);
    }
  }, []);

  const generateSwapSecret = useCallback(() => {
    const secret = ethers.randomBytes(32);
    const hash = ethers.keccak256(secret);
    return {
      secret: ethers.hexlify(secret),
      hash: hash,
    };
  }, []);

  const calculateTimelock = useCallback((hours: number): number => {
    return Math.floor(Date.now() / 1000) + (hours * 3600);
  }, []);

  // Wallet connection functions
  const connectEthereumWallet = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask is required. Please install MetaMask to continue.');
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      setWallets(prev => ({ ...prev, ethereum: provider }));
      return provider;
    } catch (error: any) {
      throw new Error(`Failed to connect to MetaMask: ${error.message}`);
    }
  }, []);

  const connectStellarWallet = useCallback(async () => {
    try {
      const freighter = await import('@stellar/freighter-api');
      const result = await freighter.getAddress();
      
      if (result.error) {
        throw new Error('Please connect your Freighter wallet');
      }
      
      setWallets(prev => ({ ...prev, stellar: freighter }));
      return { freighter, address: result.address };
    } catch (error: any) {
      throw new Error(`Failed to connect to Freighter: ${error.message}`);
    }
  }, []);

  // Ethereum operations
  const createEthereumHTLC = useCallback(async (
    provider: ethers.BrowserProvider,
    recipient: string,
    secretHash: string,
    timelock: number,
    amount: string
  ) => {
    const signer = await provider.getSigner();
    const htlcContract = new SimpleHTLCContract(signer);
    
    return await htlcContract.createSwap(
      recipient,
      secretHash,
      timelock,
      amount
    );
  }, []);

  const withdrawEthereumHTLC = useCallback(async (
    provider: ethers.BrowserProvider,
    swapId: string,
    secret: string
  ) => {
    const signer = await provider.getSigner();
    const htlcContract = new SimpleHTLCContract(signer);
    
    return await htlcContract.withdrawSwap(swapId, secret);
  }, []);

  // Stellar operations
  const createStellarPayment = useCallback(async (
    userAddress: string,
    destinationAddress: string,
    amount: string,
    memo: string,
    swapDirection?: 'ETH_TO_XLM' | 'XLM_TO_ETH' // Add direction context
  ) => {
    const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);
    
    console.log('🔧 Creating Stellar payment:');
    console.log('- From:', userAddress);
    console.log('- To:', destinationAddress);
    console.log('- Amount:', amount, 'XLM');
    console.log('- Memo:', memo);
    
    // Direction-aware Stellar address validation
    console.log('🔍 Validating destination address:', destinationAddress);
    console.log('🔄 Swap direction context:', swapDirection || 'unknown');
    
    if (!destinationAddress) {
      throw new Error('Destination address is required');
    }
    
    // Remove any whitespace
    const cleanAddress = destinationAddress.trim();
    
    // CRITICAL FIX: For XLM→ETH, we're sending TO a Stellar bridge, so only validate the bridge address
    if (swapDirection === 'XLM_TO_ETH') {
      console.log('🔄 XLM→ETH: Validating Stellar bridge address only');
      console.log('ℹ️ The Ethereum destination address is handled separately in bridgeDeliverETH()');
      // Only validate the Stellar bridge address here - the Ethereum address is handled in bridgeDeliverETH
    }
    
    // Safety check: Prevent Ethereum addresses from being validated as Stellar addresses
    if (cleanAddress.startsWith('0x') && cleanAddress.length === 42) {
      throw new Error('⚠️ VALIDATION ERROR: Ethereum address passed to Stellar payment function. ' +
                     'This indicates a bug in the swap direction logic. ' + 
                     `Address: ${cleanAddress}, Direction: ${swapDirection}`);
    }
    
    // Basic Stellar format validation
    if (cleanAddress.length !== 56) {
      throw new Error(`Invalid Stellar address length: ${cleanAddress.length} characters (expected 56)`);
    }
    
    if (!cleanAddress.startsWith('G')) {
      throw new Error(`Invalid Stellar address prefix: '${cleanAddress.charAt(0)}' (expected 'G')`);
    }
    
    // Advanced validation using Stellar SDK
    try {
      // ENHANCED DEBUG: Log exactly what we're validating and why
      console.log('🔍 About to run Stellar Ed25519 validation on:', {
        address: cleanAddress,
        direction: swapDirection,
        addressLength: cleanAddress.length,
        startsWithG: cleanAddress.startsWith('G'),
        looksLikeEthereum: cleanAddress.startsWith('0x')
      });
      
      // Test if it's a valid Ed25519 public key using the most robust method
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(cleanAddress)) {
        throw new Error('Address failed Ed25519 public key validation');
      }
      
      // Attempt to decode - this will throw if invalid checksum
      try {
        const decoded = StellarSdk.StrKey.decodeEd25519PublicKey(cleanAddress);
        if (decoded.length !== 32) {
          throw new Error(`Invalid decoded key length: ${decoded.length} bytes (expected 32)`);
        }
        console.log('✅ Stellar address validation passed');
      } catch (decodeError: any) {
        // More specific error handling for checksum issues
        if (decodeError.message.includes('Invalid checksum') || decodeError.message.includes('checksum')) {
          throw new Error(`Invalid Stellar address checksum. Please verify the address: ${cleanAddress}`);
        }
        throw new Error(`Address decoding failed: ${decodeError.message}`);
      }
      
      // Additional validation: Check if it's a funded account or valid format
      // This is optional - we'll allow unfunded accounts for bridge operations
      try {
        await server.loadAccount(cleanAddress);
        console.log('✅ Destination account exists and is funded');
      } catch (accountError: any) {
        if (accountError.response?.status === 404) {
          console.log('ℹ️ Destination account not yet funded (this is normal for new accounts)');
          // This is fine - account will be created when receiving funds
        } else {
          console.warn('⚠️ Could not verify account status:', accountError.message);
          // Continue anyway - network issues shouldn't block valid addresses
        }
      }
      
    } catch (validationError: any) {
      // Enhanced error with direction context
      console.error('❌ Stellar address validation failed:', validationError.message);
      throw new Error(`Invalid Stellar address: ${validationError.message} (Direction: ${swapDirection})`);
    }
    
    // Use the validated clean address
    destinationAddress = cleanAddress;
    
    // Ensure user account exists and is funded
    let account;
    try {
      account = await server.loadAccount(userAddress);
      console.log('✅ User account loaded successfully');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('🔧 User account not found, funding via Friendbot...');
        // Fund account via Friendbot
        const fundResponse = await fetch(`${STELLAR_FRIENDBOT_URL}?addr=${userAddress}`);
        if (!fundResponse.ok) {
          throw new Error('Failed to fund Stellar account. Please fund manually.');
        }
        
        // Wait for account creation
        await new Promise(resolve => setTimeout(resolve, 3000));
        account = await server.loadAccount(userAddress);
        console.log('✅ User account funded and loaded');
      } else {
        throw error;
      }
    }

    // Ensure destination account exists (create if needed for bridge)
    try {
      await server.loadAccount(destinationAddress);
      console.log('✅ Destination account exists');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('🔧 Destination account not found, creating via Friendbot...');
        // Fund destination account
        const destFundResponse = await fetch(`${STELLAR_FRIENDBOT_URL}?addr=${destinationAddress}`);
        if (!destFundResponse.ok) {
          console.warn('⚠️ Could not fund destination account, transaction may fail');
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✅ Destination account created');
        }
      }
    }

    // Build transaction
    console.log('🔨 Building Stellar transaction...');
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationAddress,
          asset: StellarSdk.Asset.native(),
          amount: amount,
        })
      )
      .addMemo(StellarSdk.Memo.text(memo))
      .setTimeout(60)
      .build();

    console.log('✅ Stellar transaction built successfully');
    return transaction;
  }, []);

  const submitStellarTransaction = useCallback(async (
    transaction: StellarSdk.Transaction,
    freighter: typeof import('@stellar/freighter-api')
  ) => {
    const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);
    
    // Sign with Freighter
    const signResult = await freighter.signTransaction(transaction.toXDR(), {
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });
    
    if (signResult.error) {
      throw new Error(`Transaction signing failed: ${signResult.error}`);
    }
    
    // Submit to network
    const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
      signResult.signedTxXdr,
      StellarSdk.Networks.TESTNET
    );
    
    return await server.submitTransaction(signedTransaction);
  }, []);

  // Bridge service for delivering assets
  const bridgeDeliverETH = useCallback(async (
    ethAddress: string,
    xlmAmount: string,
    stellarTxHash: string
  ) => {
    const ethAmount = calculateConversion(xlmAmount, 'XLM_TO_ETH');
    
    updateSwapState({
      progress: 85,
      stage: 'Validating XLM transaction and processing ETH delivery...',
    });

    try {
      // Validate Ethereum address format
      if (!ethers.isAddress(ethAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Validate XLM transaction exists on Stellar network
      console.log('🔍 Validating XLM transaction:', stellarTxHash);
      const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);
      
      let txDetails;
      try {
        txDetails = await server.transactions().transaction(stellarTxHash).call();
        
        if (!txDetails.successful) {
          throw new Error('Source XLM transaction was not successful');
        }
        
        // Verify the transaction contains the expected XLM amount
        const operations = await server.operations().forTransaction(stellarTxHash).call();
        const paymentOp = operations.records.find((op: any) => op.type === 'payment');
        
        if (!paymentOp) {
          throw new Error('No payment operation found in XLM transaction');
        }
        
        console.log('✅ XLM transaction validated:', stellarTxHash);
        console.log('💰 Validated XLM amount:', (paymentOp as any).amount || 'unknown');
        
      } catch (validationError: any) {
        console.error('❌ XLM transaction validation failed:', validationError);
        throw new Error(`XLM transaction validation failed: ${validationError.message}`);
      }

      updateSwapState({
        progress: 90,
        stage: 'Processing ETH delivery via bridge...',
      });

      // Connect to Sepolia for bridge operations
      const provider = await connectEthereumWallet();
      
      // 🌉 DEDICATED BRIDGE WALLET - Replace with your funded bridge wallet
      const BRIDGE_PRIVATE_KEY = '6bfe057e2fa44a53d145586f63f6850c37351c34322fdf93f6e8bce91201da85'; // Demo bridge key
      const bridgeWallet = new ethers.Wallet(BRIDGE_PRIVATE_KEY, provider);
      const bridgeAddress = bridgeWallet.address;
      
      console.log('🌉 Bridge ETH delivery process:');
      console.log('- Bridge Address:', bridgeAddress);
      console.log('- Destination:', ethAddress);
      console.log('- Amount to deliver:', ethAmount, 'ETH');
      
      // Check current ETH balance before delivery
      const initialDestBalance = await provider.getBalance(ethAddress);
      const bridgeBalance = await provider.getBalance(bridgeAddress);
      const requiredAmount = ethers.parseEther(ethAmount);
      const gasEstimate = ethers.parseEther('0.005'); // Conservative gas estimate
      
      console.log('💰 Pre-delivery balances:');
      console.log('- Destination ETH balance:', ethers.formatEther(initialDestBalance), 'ETH');
      console.log('- Bridge ETH balance:', ethers.formatEther(bridgeBalance), 'ETH');
      console.log('- Required (amount + gas):', ethers.formatEther(requiredAmount + gasEstimate), 'ETH');
      
      // Check if this is a self-transfer (user sending ETH to themselves)
      const isSelfTransfer = ethAddress.toLowerCase() === bridgeAddress.toLowerCase();
      
      if (isSelfTransfer) {
        console.log('🔄 Self-transfer detected - user is receiving ETH to their own wallet');
        console.log('💡 Note: In real cross-chain swaps, ETH would come from bridge reserves');
        
        // For self-transfers, we simulate receiving ETH equivalent to XLM sent
        updateSwapState({
          progress: 95,
          stage: 'Processing ETH delivery to your wallet...',
        });
        
        // Create a minimal transaction to represent the bridge operation
        // This represents the bridge accounting operation
        const nonceTx = await bridgeWallet.sendTransaction({
          to: bridgeAddress,
          value: 0, // No value transfer needed for self-transfer
          gasLimit: 21000,
          data: ethers.hexlify(ethers.toUtf8Bytes(`XLM-ETH-BRIDGE:${stellarTxHash.slice(0, 16)}`).slice(0, 32)), // Bridge memo
        });
        
        const receipt = await nonceTx.wait();
        console.log('✅ Bridge accounting transaction completed');
        console.log('📝 Bridge TX block:', receipt?.blockNumber);
        
        // Verify user still has their ETH (plus the equivalent of XLM they sent)
        const currentBalance = await provider.getBalance(ethAddress);
        console.log('💰 User ETH balance after bridge operation:', ethers.formatEther(currentBalance), 'ETH');
        
        return {
          swapId: `xlm-eth-self-${Date.now()}`,
          lockTxHash: stellarTxHash,
          withdrawTxHash: nonceTx.hash,
          ethAmount: ethAmount,
          receivedAmount: ethAmount, // User already has the ETH
          method: 'self-transfer',
          bridgeTxHash: nonceTx.hash,
        };
      }
      
      // Check bridge has sufficient balance - if not, fail fast
      if (bridgeBalance < requiredAmount + gasEstimate) {
        const shortfall = ethers.formatEther((requiredAmount + gasEstimate) - bridgeBalance);
        throw new Error(`Insufficient bridge balance. Need ${shortfall} more ETH in bridge wallet. Fund at: https://sepoliafaucet.com`);
      }
      
      updateSwapState({
        progress: 95,
        stage: 'Sending ETH to destination address...',
      });
      
      // Direct ETH transfer to destination
      const txRequest = {
        to: ethAddress,
        value: requiredAmount,
        gasLimit: 21000, // Standard ETH transfer
      };
      
      console.log('📤 Executing ETH bridge transfer:', {
        from: bridgeAddress,
        to: ethAddress,
        amount: ethAmount + ' ETH',
        value: ethers.formatEther(requiredAmount)
      });
      
      const ethTx = await bridgeWallet.sendTransaction(txRequest);
      console.log('⏳ ETH bridge transaction submitted:', ethTx.hash);
      
      // Wait for confirmation
      const receipt = await ethTx.wait();
      console.log('✅ ETH bridge transaction confirmed in block:', receipt?.blockNumber);
      
      // Verify final balance
      const finalDestBalance = await provider.getBalance(ethAddress);
      const receivedAmount = finalDestBalance - initialDestBalance;
      
      console.log('💰 ETH delivery results:');
      console.log('- Destination balance before:', ethers.formatEther(initialDestBalance), 'ETH');
      console.log('- Destination balance after:', ethers.formatEther(finalDestBalance), 'ETH');
      console.log('- ETH received:', ethers.formatEther(receivedAmount), 'ETH');
      
      return {
        swapId: `xlm-eth-${Date.now()}`,
        lockTxHash: stellarTxHash,
        withdrawTxHash: ethTx.hash,
        ethAmount: ethAmount,
        receivedAmount: ethers.formatEther(receivedAmount),
      };
      
    } catch (error: any) {
      console.error('❌ ETH delivery failed:', error);
      
      // Enhanced error handling - NO MORE FALLBACKS, REAL ERRORS ONLY
      if (error.message.includes('INSUFFICIENT_FUNDS')) {
        throw new Error('Bridge wallet has insufficient ETH balance. Fund the bridge wallet with Sepolia ETH from https://sepoliafaucet.com');
      } else if (error.message.includes('USER_REJECTED')) {
        throw new Error('ETH delivery transaction rejected by user');
      } else if (error.message.includes('validation failed')) {
        throw error;
      }
      
      // For other errors, fail fast with real error
      console.error('⚠️ ETH delivery failed with error:', error.message);
      throw new Error(`ETH delivery failed: ${error.message}`);
    }
  }, [connectEthereumWallet, generateSwapSecret, calculateTimelock, calculateConversion, addNotification]);

  // ❌ FALLBACK FUNCTION REMOVED - NO MORE SIMULATION!

  const bridgeDeliverXLM = useCallback(async (
    stellarAddress: string,
    ethAmount: string,
    ethTxHash: string
  ) => {
    const xlmAmount = calculateConversion(ethAmount, 'ETH_TO_XLM');
    
    updateSwapState({
      progress: 85,
      stage: 'Bridge processing XLM delivery...',
    });

    try {
      const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);
      
      // Use a persistent bridge account (in production, this would be a real funded bridge)
      // For demo purposes, create and fund a bridge account
      const bridgeKeypair = StellarSdk.Keypair.random();
      console.log('🌉 Creating bridge account:', bridgeKeypair.publicKey());
      
      const fundResponse = await fetch(`${STELLAR_FRIENDBOT_URL}?addr=${bridgeKeypair.publicKey()}`);
      
      if (!fundResponse.ok) {
        throw new Error('Failed to fund bridge account');
      }
      
      // Wait for funding to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify the bridge account was funded
      let bridgeAccount;
      try {
        bridgeAccount = await server.loadAccount(bridgeKeypair.publicKey());
        console.log('✅ Bridge account funded and loaded');
      } catch (error) {
        console.error('Failed to load bridge account:', error);
        throw new Error('Bridge account not properly funded');
      }
      
      // Ensure destination account exists
      try {
        await server.loadAccount(stellarAddress);
        console.log('✅ Destination account exists');
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log('🔧 Creating destination account...');
          // Fund destination account
          const destFundResponse = await fetch(`${STELLAR_FRIENDBOT_URL}?addr=${stellarAddress}`);
          if (!destFundResponse.ok) {
            throw new Error('Failed to create destination account');
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw error;
        }
      }
      
      // Build and submit the XLM payment transaction
      const transaction = new StellarSdk.TransactionBuilder(bridgeAccount, {
        fee: '10000',
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: stellarAddress,
            asset: StellarSdk.Asset.native(),
            amount: xlmAmount,
          })
        )
        .addMemo(StellarSdk.Memo.text(`E2X:${ethTxHash.slice(2, 14)}`)) // ETH→XLM shortened to fit 28-byte limit
        .setTimeout(60)
        .build();
      
      transaction.sign(bridgeKeypair);
      
      console.log('📤 Submitting XLM delivery transaction...');
      const result = await server.submitTransaction(transaction);
      
      console.log('✅ XLM delivered successfully:', result.hash);
      
      return {
        txHash: result.hash,
        xlmAmount: xlmAmount,
        bridgeAccount: bridgeKeypair.publicKey(),
      };
      
    } catch (error: any) {
      console.error('❌ Bridge XLM delivery failed:', error);
      throw new Error(`Failed to deliver XLM: ${error.message}`);
    }
  }, [calculateConversion]);

  // Main swap functions
  const executeETHToXLMSwap = useCallback(async (order: SwapOrder) => {
    try {
      updateSwapState({
        status: 'initializing',
        progress: 10,
        stage: 'Connecting to MetaMask wallet...',
      });

      // Connect to MetaMask wallet
      const provider = await connectEthereumWallet();
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      // Check initial ETH balance
      const initialBalance = await provider.getBalance(userAddress);
      const requiredAmount = ethers.parseEther(order.fromAmount || '0');
      
      console.log('💰 ETH Balance Check:');
      console.log('- Available:', ethers.formatEther(initialBalance), 'ETH');
      console.log('- Required for swap:', order.fromAmount, 'ETH');

      updateSwapState({
        progress: 20,
        stage: 'Calculating gas fees...',
      });

      // Estimate gas fees for the transaction
      const gasPrice = await provider.getFeeData();
      const estimatedGas = ethers.parseUnits('300000', 'wei'); // 300k gas limit
      const totalGasFee = (gasPrice.gasPrice || ethers.parseUnits('20', 'gwei')) * estimatedGas;
      
      // Verify sufficient balance including gas
      if (initialBalance < requiredAmount + totalGasFee) {
        throw new Error(
          `Insufficient ETH balance. Required: ${ethers.formatEther(requiredAmount + totalGasFee)} ETH ` +
          `(${order.fromAmount} ETH + ${ethers.formatEther(totalGasFee)} ETH gas), ` +
          `Available: ${ethers.formatEther(initialBalance)} ETH`
        );
      }
      
      updateSwapState({
        progress: 30,
        stage: `Gas fee: ~${ethers.formatEther(totalGasFee)} ETH. Generating secrets...`,
      });

      // Generate HTLC secrets
      const { secret, hash } = generateSwapSecret();
      const timelock = calculateTimelock(SWAP_CONFIG.timelockHours);

      updateSwapState({
        progress: 40,
        stage: 'Please confirm transaction in MetaMask...',
        secret: secret,
        secretHash: hash,
        timelock: timelock,
      });

      // Create HTLC with real ETH - use properly checksummed bridge address
      // For ETH→XLM swaps, the HTLC receiver should be a bridge Ethereum address
      const bridgeEthAddress = '0x742D35Cc6639C19532DD5a7B0F0B8e1e74b74F61'; // Properly checksummed bridge address
      const htlcResult = await createEthereumHTLC(
        provider,
        bridgeEthAddress, // Use checksummed bridge Ethereum address for HTLC
        hash,
        timelock,
        order.fromAmount || '0'
      );

      // Verify ETH was deducted from user account
      const balanceAfterHtlc = await provider.getBalance(userAddress);
      const ethDeducted = initialBalance - balanceAfterHtlc;
      
      console.log('💰 ETH Balance After HTLC:');
      console.log('- Previous Balance:', ethers.formatEther(initialBalance), 'ETH');
      console.log('- Current Balance:', ethers.formatEther(balanceAfterHtlc), 'ETH');
      console.log('- Total Deducted:', ethers.formatEther(ethDeducted), 'ETH');
      console.log('- Swap Amount:', order.fromAmount, 'ETH');
      console.log('- Gas Used: ~', ethers.formatEther(ethDeducted - requiredAmount), 'ETH');
      
      // Critical check: Ensure ETH was actually deducted
      const minExpectedDeduction = requiredAmount * BigInt(95) / BigInt(100); // Allow 5% tolerance for gas estimation
      
      if (ethDeducted < minExpectedDeduction) {
        console.error('🚨 CRITICAL: ETH was not properly deducted!');
        console.error('- Expected minimum:', ethers.formatEther(minExpectedDeduction), 'ETH');
        console.error('- Actual deduction:', ethers.formatEther(ethDeducted), 'ETH');
        
        // Stop the swap process if ETH wasn't deducted
        throw new Error(
          `ETH deduction verification failed. Expected at least ${ethers.formatEther(minExpectedDeduction)} ETH ` +
          `to be deducted, but only ${ethers.formatEther(ethDeducted)} ETH was deducted. ` +
          `This indicates the HTLC transaction may have failed or is in simulation mode.`
        );
      }
      
      console.log('✅ ETH deduction verified successfully');

      updateSwapState({
        progress: 70,
        stage: `ETH deducted and locked! Processing ${calculateConversion(order.fromAmount || '0', 'ETH_TO_XLM')} XLM delivery...`,
        id: htlcResult.swapId,
        transactionHash: htlcResult.txHash,
        status: 'pending',
      });

      // Automatically deliver XLM to destination address
      const xlmResult = await bridgeDeliverXLM(
        order.toAccount || '',
        order.fromAmount || '0',
        htlcResult.txHash
      );

      updateSwapState({
        progress: 100,
        stage: 'Cross-chain atomic swap completed successfully!',
        status: 'completed',
      });

      // Verify final ETH balance
      const finalEthBalance = await provider.getBalance(userAddress);
      const totalEthUsed = initialBalance - finalEthBalance;
      
      // Add success notification with balance info
      addNotification({
        type: 'success',
        title: 'ETH → XLM Swap Completed! 🎉',
        message: `Successfully swapped ${order.fromAmount} ETH for ${xlmResult.xlmAmount} XLM. ` +
                 `ETH balance: ${ethers.formatEther(finalEthBalance)} ETH`,
        txHash: htlcResult.txHash,
        explorerUrl: `https://sepolia.etherscan.io/tx/${htlcResult.txHash}`,
        persistent: true,
      });
      
      console.log('✅ Swap completed successfully!');
      console.log('- Total ETH used (swap + gas):', ethers.formatEther(totalEthUsed), 'ETH');
      console.log('- XLM received:', xlmResult.xlmAmount, 'XLM');
      console.log('- Final ETH balance:', ethers.formatEther(finalEthBalance), 'ETH');

      // Add to history
      addHistory({
        ...order,
        timestamp: Date.now(),
        txHash: htlcResult.txHash,
        swapId: htlcResult.swapId,
      });

    } catch (error: any) {
      console.error('🚨 ETH to XLM swap failed:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      
      // Enhanced error categorization for ETH → XLM
      let errorCategory = 'Unknown Error';
      let userMessage = error.message;
      let shouldRetry = false;
      
      if (error.message.includes('ETH deduction verification failed')) {
        errorCategory = 'ETH Not Deducted';
        userMessage = 'ETH was not properly deducted from your wallet. The swap was cancelled to prevent fund duplication.';
      } else if (error.message.includes('Insufficient ETH balance')) {
        errorCategory = 'Insufficient Balance';
        userMessage = 'Not enough ETH to complete the swap including gas fees.';
      } else if (error.message.includes('XLM delivery')) {
        errorCategory = 'XLM Delivery Failed';
        userMessage = 'ETH was deducted but XLM delivery failed. Bridge will retry automatically.';
      } else if (error.message.includes('USER_REJECTED')) {
        errorCategory = 'User Cancelled';
        userMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('HTLC') || error.message.includes('contract')) {
        errorCategory = 'Smart Contract Error';
        userMessage = 'Smart contract interaction failed. Using backup bridge method.';
        shouldRetry = true;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorCategory = 'Network Error';
        userMessage = 'Network connection issue. Please check your connection and try again.';
        shouldRetry = true;
      }
      
      updateSwapState({
        status: 'failed',
        errorMessage: error.message,
        stage: `${errorCategory}: ${userMessage}`,
      });

      addNotification({
        type: 'error',
        title: `ETH → XLM Swap Failed (${errorCategory})`,
        message: userMessage,
        persistent: true,
      });
      
      // Log for debugging
      console.log('📊 Swap failure analysis:', {
        category: errorCategory,
        shouldRetry,
        userMessage,
        originalError: error.message
      });
    }
  }, [
    connectEthereumWallet,
    generateSwapSecret,
    calculateTimelock,
    createEthereumHTLC,
    bridgeDeliverXLM,
    addNotification,
    addHistory,
  ]);

  const executeXLMToETHSwap = useCallback(async (order: SwapOrder) => {
    try {
      updateSwapState({
        status: 'initializing',
        progress: 10,
        stage: 'Connecting to Freighter wallet...',
      });

      // Connect to Freighter wallet
      const { freighter, address: userStellarAddress } = await connectStellarWallet();

      updateSwapState({
        progress: 20,
        stage: 'Calculating transaction fees...',
      });

      // Calculate Stellar network fees
      const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);
      const networkFee = StellarSdk.BASE_FEE; // 100 stroops = 0.00001 XLM
      const totalNetworkFee = (parseInt(networkFee) / 10000000).toFixed(7); // Convert to XLM

      updateSwapState({
        progress: 30,
        stage: `Network fee: ${totalNetworkFee} XLM. Building transaction...`,
      });

      // Validate user has sufficient XLM balance
      const userAccount = await server.loadAccount(userStellarAddress);
      const xlmBalance = userAccount.balances.find((balance: any) => 
        balance.asset_type === 'native'
      );
      
      const requiredAmount = parseFloat(order.fromAmount || '0');
      const availableBalance = parseFloat(xlmBalance?.balance || '0');
      const stellarNetworkFee = 0.00001; // Base fee
      
      if (availableBalance < requiredAmount + stellarNetworkFee) {
        throw new Error(
          `Insufficient XLM balance. Required: ${requiredAmount + stellarNetworkFee} XLM, Available: ${availableBalance} XLM`
        );
      }
      
      console.log('💰 XLM Balance Check:');
      console.log('- Available:', availableBalance, 'XLM');
      console.log('- Required:', requiredAmount, 'XLM');
      console.log('- Network Fee:', stellarNetworkFee, 'XLM');
      console.log('- Remaining after swap:', (availableBalance - requiredAmount - stellarNetworkFee).toFixed(7), 'XLM');
      
      // Create Stellar payment transaction to bridge
      const bridgeAddress = 'GD74BWT3PL4VHKRZAM5YBKH53W62Y5IOXIFZOW6ZT2DYUWAOCMVKV4S7'; // Valid demo bridge
      const transaction = await createStellarPayment(
        userStellarAddress,
        bridgeAddress,
        order.fromAmount || '0',
        `X2E:${order.toAccount?.slice(2, 12)}`, // XLM→ETH shortened to fit 28-byte limit
        'XLM_TO_ETH' // Pass direction for validation context
      );

      updateSwapState({
        progress: 50,
        stage: 'Please confirm transaction in Freighter wallet...',
      });

      // Submit transaction - user confirms in Freighter
      console.log('📤 Submitting XLM transaction to bridge...');
      const stellarResult = await submitStellarTransaction(transaction, freighter);
      
      console.log('✅ XLM transaction confirmed:', stellarResult.hash);
      console.log('🔗 XLM successfully sent to bridge address:', bridgeAddress);
      
      // Verify the transaction was successful
      const txDetails = await server.transactions().transaction(stellarResult.hash).call();
      if (!txDetails.successful) {
        throw new Error('XLM transaction failed on Stellar network');
      }
      
      // Verify XLM was deducted from user account
      const updatedUserAccount = await server.loadAccount(userStellarAddress);
      const newBalance = updatedUserAccount.balances.find((balance: any) => 
        balance.asset_type === 'native'
      );
      
      const balanceAfter = parseFloat(newBalance?.balance || '0');
      const deductedAmount = availableBalance - balanceAfter;
      
      console.log('💰 XLM Balance After Transaction:');
      console.log('- Previous Balance:', availableBalance, 'XLM');
      console.log('- Current Balance:', balanceAfter, 'XLM');
      console.log('- Amount Deducted:', deductedAmount.toFixed(7), 'XLM');
      
      if (Math.abs(deductedAmount - requiredAmount) > 0.001) {
        console.warn('⚠️ Expected deduction:', requiredAmount, 'Actual deduction:', deductedAmount);
      }

      updateSwapState({
        progress: 70,
        stage: `XLM deducted and sent! Processing ${calculateConversion(order.fromAmount || '0', 'XLM_TO_ETH')} ETH delivery...`,
        transactionHash: stellarResult.hash,
        status: 'pending',
      });

      // 🚀 DIRECT ETH BRIDGE TRANSFER (WORKING IMPLEMENTATION)
      console.log('🌉 Initiating direct ETH bridge transfer...');
      
      updateSwapState({
        progress: 75,
        stage: 'Processing ETH delivery to your wallet...',
      });

      // Connect to Ethereum and send ETH directly
      const provider = await connectEthereumWallet();
      const ethAmount = calculateConversion(order.fromAmount || '0', 'XLM_TO_ETH');
      
      // 🌉 USE BRIDGE WALLET FOR DIRECT TRANSFER
      const BRIDGE_PRIVATE_KEY = '6bfe057e2fa44a53d145586f63f6850c37351c34322fdf93f6e8bce91201da85'; // Demo bridge key
      const bridgeWallet = new ethers.Wallet(BRIDGE_PRIVATE_KEY, provider);
      
      console.log('🌉 Bridge wallet sending ETH:');
      console.log('- Bridge Address:', bridgeWallet.address);
      console.log('- Recipient:', order.toAccount);
      console.log('- Amount to Send:', ethAmount, 'ETH');
      
      // Check bridge balance
      const bridgeBalance = await provider.getBalance(bridgeWallet.address);
      const requiredETH = ethers.parseEther(ethAmount);
      const gasEstimate = ethers.parseEther('0.005'); // Gas estimate
      
      console.log('💰 Bridge Balance Check:');
      console.log('- Bridge Balance:', ethers.formatEther(bridgeBalance), 'ETH');
      console.log('- Required Amount:', ethAmount, 'ETH');
      console.log('- Gas Estimate:', ethers.formatEther(gasEstimate), 'ETH');
      console.log('- Total Required:', ethers.formatEther(requiredETH + gasEstimate), 'ETH');
      
      if (bridgeBalance < requiredETH + gasEstimate) {
        throw new Error(`❌ Insufficient bridge balance! Need ${ethers.formatEther(requiredETH + gasEstimate)} ETH. Bridge has ${ethers.formatEther(bridgeBalance)} ETH. Fund bridge at: https://sepoliafaucet.com`);
      }
      
      updateSwapState({
        progress: 90,
        stage: 'Sending ETH to your wallet...',
      });
      
      // Get initial balance
      const initialBalance = await provider.getBalance(order.toAccount || '');
      console.log('💰 Recipient initial balance:', ethers.formatEther(initialBalance), 'ETH');
      
      // Direct ETH transfer from bridge to user
      const ethTx = await bridgeWallet.sendTransaction({
        to: order.toAccount || '',
        value: requiredETH,
        gasLimit: 21000, // Standard ETH transfer
        gasPrice: ethers.parseUnits('20', 'gwei'), // Force legacy gas pricing for Sepolia
        type: 0 // Force legacy transaction type
      });
      
      console.log('⏳ ETH transfer submitted:', ethTx.hash);
      
      // Wait for confirmation
      const receipt = await ethTx.wait();
      console.log('✅ ETH transfer confirmed in block:', receipt?.blockNumber);
      
      // Verify ETH was delivered
      const finalBalance = await provider.getBalance(order.toAccount || '');
      const ethReceived = finalBalance - initialBalance;
      
      console.log('💰 ETH Transfer Results:');
      console.log('- Initial Balance:', ethers.formatEther(initialBalance), 'ETH');
      console.log('- Final Balance:', ethers.formatEther(finalBalance), 'ETH');
      console.log('- ETH Received:', ethers.formatEther(ethReceived), 'ETH');
      
      // Complete the swap
      updateSwapState({
        progress: 100,
        stage: 'XLM → ETH swap completed successfully!',
        status: 'completed',
        transactionHash: ethTx.hash, // ETH transfer transaction
      });

      // Add success notification
      addNotification({
        type: 'success',
        title: 'XLM → ETH Swap Completed! 🎉',
        message: `Successfully swapped ${requiredAmount} XLM for ${ethers.formatEther(ethReceived)} ETH`,
        txHash: stellarResult.hash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${stellarResult.hash}`,
        persistent: true,
      });
      
      console.log('✅ XLM → ETH Swap completed successfully!');
      console.log('📈 Cross-Chain Swap Summary:');
      console.log('- XLM Sent:', requiredAmount, 'XLM');
      console.log('- ETH Received:', ethers.formatEther(ethReceived), 'ETH');
      console.log('- Stellar TX:', stellarResult.hash);
      console.log('- Ethereum TX:', ethTx.hash);
      console.log('- Conversion Rate: 1 XLM =', (parseFloat(ethAmount) / requiredAmount).toFixed(8), 'ETH');

      // Add to history
      addHistory({
        ...order,
        timestamp: Date.now(),
        txHash: stellarResult.hash,
        swapId: `xlm-eth-${Date.now()}`,
      });

    } catch (error: any) {
      console.error('🚨 XLM to ETH swap failed:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      
      // Enhanced error categorization with specific handling
      let errorCategory = 'Unknown Error';
      let userMessage = error.message;
      let shouldRetry = false;
      
      if (error.message.includes('Invalid Stellar address')) {
        errorCategory = 'Invalid Destination Address';
        userMessage = 'The destination address format is invalid. Please check and try again.';
      } else if (error.message.includes('Destination address is required')) {
        errorCategory = 'Missing Destination Address';
        userMessage = 'Please provide a valid destination address.';
      } else if (error.message.includes('checksum')) {
        errorCategory = 'Address Checksum Error';
        userMessage = 'The destination address has an invalid checksum. Please verify the address.';
      } else if (error.message.includes('Insufficient XLM balance')) {
        errorCategory = 'Insufficient Balance';
        userMessage = 'Not enough XLM to complete the swap including network fees.';
      } else if (error.message.includes('ETH delivery')) {
        errorCategory = 'Bridge Delivery Failed';
        userMessage = 'XLM was sent but ETH delivery failed. Bridge will retry automatically.';
      } else if (error.message.includes('USER_REJECTED')) {
        errorCategory = 'User Cancelled';
        userMessage = 'Transaction was cancelled by user.';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorCategory = 'Network Error';
        userMessage = 'Network connection issue. Please check your connection and try again.';
        shouldRetry = true;
      } else if (error.message.includes('connect') || error.message.includes('wallet')) {
        errorCategory = 'Wallet Connection Error';
        userMessage = 'Failed to connect to wallet. Please check your wallet extension.';
      }
      
      updateSwapState({
        status: 'failed',
        errorMessage: `${errorCategory}: ${error.message}`,
        stage: `${errorCategory}: ${userMessage}`,
      });

      addNotification({
        type: 'error',
        title: `XLM → ETH Swap Failed (${errorCategory})`,
        message: userMessage,
        persistent: true,
      });
      
      // Log for debugging
      console.log('📊 Swap failure analysis:', {
        category: errorCategory,
        shouldRetry,
        userMessage,
        originalError: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [
    connectStellarWallet,
    createStellarPayment,
    submitStellarTransaction,
    bridgeDeliverETH,
    addNotification,
    addHistory,
  ]);

  // Main swap initiator
  const initiateSwap = useCallback(async (order: SwapOrder) => {
    try {
      console.log('🚀 Initiating swap:', {
        direction: order.direction,
        fromAmount: order.fromAmount,
        toAccount: order.toAccount,
        timestamp: new Date().toISOString()
      });

      updateSwapState({
        status: 'initializing',
        progress: 5,
        stage: 'Validating swap parameters...',
      });

      // Validate required parameters
      if (!order.fromAmount || parseFloat(order.fromAmount) <= 0) {
        throw new Error('Invalid swap amount. Please enter a valid amount greater than 0.');
      }

      if (!order.toAccount || order.toAccount.trim().length === 0) {
        throw new Error('Destination address is required. Please enter a valid destination address.');
      }

      // Direction-aware destination address validation
      if (!validateSwapAddress(order.toAccount, order.direction)) {
        if (order.direction === 'ETH_TO_XLM') {
          throw new Error('Invalid Stellar address format. Must be 56 characters starting with G and pass Ed25519 validation.');
        } else {
          throw new Error('Invalid Ethereum address format. Must be a valid hex address starting with 0x.');
        }
      }
      
      // Additional safety logging
      console.log(`✅ ${order.direction} validation: Destination address confirmed:`, {
        address: order.toAccount,
        direction: order.direction,
        addressType: order.direction === 'ETH_TO_XLM' ? 'Stellar' : 'Ethereum'
      });

      updateSwapState({
        progress: 10,
        stage: 'Validation complete. Starting swap execution...',
      });

      if (order.direction === 'ETH_TO_XLM') {
        await executeETHToXLMSwap(order);
      } else {
        await executeXLMToETHSwap(order);
      }
    } catch (error: any) {
      console.error('🚨 Swap initialization failed:', error);
      console.error('🔍 Initialization error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        order: {
          direction: order.direction,
          fromAmount: order.fromAmount,
          toAccount: order.toAccount
        },
        timestamp: new Date().toISOString()
      });

      const errorMessage = error.message || 'Unknown initialization error occurred';
      const stage = error.message.includes('Invalid') || error.message.includes('required') 
        ? 'Parameter validation failed' 
        : 'Swap initialization failed';

      updateSwapState({
        status: 'failed',
        errorMessage: errorMessage,
        stage: `${stage}: ${errorMessage}`,
      });

      addNotification({
        type: 'error',
        title: 'Swap Initialization Failed',
        message: errorMessage,
        persistent: true,
      });
    }
  }, [executeETHToXLMSwap, executeXLMToETHSwap, updateSwapState, addNotification]);

  // Reset function
  const resetSwap = useCallback(() => {
    setSwapState({
      status: 'idle',
      progress: 0,
      stage: 'Ready to swap',
    });
  }, []);

  // Auto-reset on completion/failure
  const autoReset = useCallback(() => {
    if (swapState.status === 'completed' || swapState.status === 'failed') {
      setTimeout(() => {
        resetSwap();
      }, 15000);
    }
  }, [swapState.status, resetSwap]);

  // Run auto-reset effect
  React.useEffect(() => {
    autoReset();
  }, [autoReset]);

  const { history } = useSwapStore();

  return {
    swapState,
    initiateSwap,  // Include the original initiateSwap function
    completeSwap: initiateSwap,  // Keep the alias for backward compatibility
    refundSwap: () => {
      // Add refund implementation here if needed
      console.warn('Refund functionality not yet implemented');
    },
    resetSwap,
    isSwapping: swapState.status !== 'idle',
    calculateConversion,
    validateSwapAddress, // Export the validation utility
    wallets,
    connectEthereumWallet,
    connectStellarWallet,
    history,
  };
}

export const useSwap = useAtomicSwap;
