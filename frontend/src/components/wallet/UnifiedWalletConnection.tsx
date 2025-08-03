"use client";

// import { useState } from "react";
import { useMultiWallet } from "./WalletProvider";
import { useStellarWallet } from "./StellarWalletProvider";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  RefreshCw, 
  Star,
  Coins
} from "lucide-react";

export function UnifiedWalletConnection() {
  // For future use when modal is needed
  // const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Ethereum wallet state
  const { 
    isConnected: ethConnected, 
    address: ethAddress, 
    balance: ethBalance, 
    error: ethError, 
    isLoading: ethLoading,
    isWrongNetwork,
    // walletType: ethWalletType,
    disconnectWallet: disconnectEth,
    switchAccount: switchEthAccount,
    refreshBalance: refreshEthBalance,
    switchToSepolia,
    connectWallet: connectEthWallet
  } = useMultiWallet();

  // Stellar wallet state
  const {
    isConnected: stellarConnected,
    publicKey: stellarAddress,
    balance: stellarBalance,
    error: stellarError,
    isLoading: stellarLoading,
    // walletType: stellarWalletType,
    disconnectWallet: disconnectStellar,
    refreshBalance: refreshStellarBalance,
    connectWallet: connectStellarWallet
  } = useStellarWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (bal: string) => {
    const num = parseFloat(bal);
    return num.toFixed(4);
  };

  const handleConnectEthereum = async () => {
    try {
      await connectEthWallet('metamask');
      // setShowWalletModal(false);
    } catch (error) {
      console.error('Failed to connect Ethereum wallet:', error);
    }
  };

  const handleConnectStellar = async () => {
    try {
      await connectStellarWallet('freighter');
      // setShowWalletModal(false);
    } catch (error) {
      console.error('Failed to connect Stellar wallet:', error);
    }
  };

  if (ethLoading || stellarLoading) {
    return (
      <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-white">Checking wallet connections...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Ethereum Wallet Section */}
        <Card className={`${
          ethConnected && !isWrongNetwork 
            ? "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-500/50" 
            : isWrongNetwork
            ? "bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-amber-500/50"
            : "bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600"
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-white">
              <Coins className="w-5 h-5" />
              <span>Ethereum Wallet</span>
              {ethConnected && !isWrongNetwork && <CheckCircle className="w-4 h-4 text-green-400" />}
              {isWrongNetwork && <AlertCircle className="w-4 h-4 text-amber-400" />}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {ethConnected ? (
                isWrongNetwork ? "Please switch to Sepolia Testnet" : "Connected to Sepolia Testnet"
              ) : (
                "Connect your MetaMask for Ethereum transactions"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!ethConnected ? (
              <div className="space-y-3">
                <Button 
                  onClick={handleConnectEthereum}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  🦊 Connect MetaMask
                </Button>
                {ethError && (
                  <div className="flex items-center space-x-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{ethError}</span>
                  </div>
                )}
              </div>
            ) : isWrongNetwork ? (
              <div className="space-y-3">
                <Button 
                  onClick={switchToSepolia}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  Switch to Sepolia
                </Button>
                <Button 
                  onClick={disconnectEth}
                  variant="outline"
                  size="sm"
                  className="w-full text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-green-100 font-medium">
                      {formatAddress(ethAddress!)}
                    </div>
                    <div className="text-sm text-green-200">
                      {formatBalance(ethBalance)} SepoliaETH
                    </div>
                  </div>
                  <button
                    onClick={refreshEthBalance}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => window.open(`https://sepolia.etherscan.io/address/${ethAddress}`, "_blank")}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Explorer
                  </Button>
                  <Button 
                    onClick={switchEthAccount}
                    variant="outline" 
                    size="sm"
                    className="flex-1 text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    Switch
                  </Button>
                  <Button 
                    onClick={disconnectEth}
                    variant="outline" 
                    size="sm"
                    className="flex-1 text-red-300 border-red-600 hover:bg-red-900/50"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stellar Wallet Section */}
        <Card className={`${
          stellarConnected 
            ? "bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border-purple-500/50" 
            : "bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600"
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-white">
              <Star className="w-5 h-5" />
              <span>Stellar Wallet</span>
              {stellarConnected && <CheckCircle className="w-4 h-4 text-purple-400" />}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {stellarConnected ? "Connected to Stellar Testnet" : "Connect your Freighter for Stellar transactions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!stellarConnected ? (
              <div className="space-y-3">
                <Button 
                  onClick={handleConnectStellar}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  🚀 Connect Freighter
                </Button>
                {stellarError && (
                  <div className="flex items-center space-x-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{stellarError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-purple-100 font-medium">
                      {formatAddress(stellarAddress!)}
                    </div>
                    <div className="text-sm text-purple-200">
                      {formatBalance(stellarBalance)} XLM
                    </div>
                  </div>
                  <button
                    onClick={refreshStellarBalance}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={() => window.open(`https://stellar.expert/explorer/testnet/account/${stellarAddress}`, "_blank")}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Explorer
                  </Button>
                  <Button 
                    onClick={disconnectStellar}
                    variant="outline" 
                    size="sm"
                    className="flex-1 text-red-300 border-red-600 hover:bg-red-900/50"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status Summary */}
        {(ethConnected || stellarConnected) && (
          <Card className="bg-slate-700/30 border-slate-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  <span className="font-medium">Wallet Status:</span>
                  <span className="ml-2">
                    {ethConnected && !isWrongNetwork ? "✅ Ethereum" : "❌ Ethereum"}
                    {" • "}
                    {stellarConnected ? "✅ Stellar" : "❌ Stellar"}
                  </span>
                </div>
                {ethConnected && stellarConnected && !isWrongNetwork && (
                  <div className="text-green-400 text-sm font-medium flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Ready to Swap</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}