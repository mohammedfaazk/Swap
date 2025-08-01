"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { SwapState } from "@/hooks/useSwap";
import { Copy, ExternalLink, Clock, Key, Hash, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface SwapDetailsProps {
  swapState: SwapState;
  onComplete?: (swapId: string, secret: string) => void;
  onRefund?: (swapId: string) => void;
  onReset?: () => void;
}

export function SwapDetails({ swapState, onComplete, onRefund, onReset }: SwapDetailsProps) {
  const [secretInput, setSecretInput] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
    console.log(`${label} copied to clipboard:`, text);
  };

  const getStatusColor = (status: SwapState['status']) => {
    switch (status) {
      case 'creating': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'waiting_counterparty': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'refunded': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: SwapState['status']) => {
    switch (status) {
      case 'creating': return <Clock className="w-4 h-4" />;
      case 'waiting_counterparty': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'refunded': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatStatus = (status: SwapState['status']) => {
    switch (status) {
      case 'creating': return 'Creating Swap';
      case 'waiting_counterparty': return 'Waiting for Counterparty';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'refunded': return 'Refunded';
      default: return 'Unknown';
    }
  };

  const isExpired = () => {
    if (!swapState.timelock) return false;
    return Date.now() / 1000 > swapState.timelock;
  };

  const getTimeRemaining = () => {
    if (!swapState.timelock) return null;
    const remaining = swapState.timelock - Date.now() / 1000;
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (swapState.status === 'idle') {
    return null;
  }

  return (
    <Card className="bg-slate-800/60 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Atomic Swap Details</CardTitle>
          <Badge className={`${getStatusColor(swapState.status)} flex items-center gap-2`}>
            {getStatusIcon(swapState.status)}
            {formatStatus(swapState.status)}
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Monitor and manage your cross-chain atomic swap
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Swap ID */}
        {swapState.swapId && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Swap ID</label>
            <div className="flex items-center space-x-2">
              <Input
                value={swapState.swapId}
                readOnly
                className="font-mono text-sm bg-slate-700/50 border-slate-600"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(swapState.swapId!, "Swap ID")}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Secret Hash */}
        {swapState.secretHash && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Secret Hash (Public)
            </label>
            <div className="flex items-center space-x-2">
              <Input
                value={swapState.secretHash}
                readOnly
                className="font-mono text-sm bg-slate-700/50 border-slate-600"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(swapState.secretHash!, "Secret Hash")}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Secret (Only shown if we created this swap) */}
        {swapState.secret && swapState.status !== 'completed' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand flex items-center gap-2">
              <Key className="w-4 h-4" />
              Secret (KEEP SAFE!)
            </label>
            <div className="bg-brand/10 border border-brand/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Input
                  value={swapState.secret}
                  readOnly
                  className="font-mono text-sm bg-brand/20 border-brand/30 text-brand-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(swapState.secret!, "Secret")}
                  className="border-brand/30 text-brand hover:bg-brand/20"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-brand/80">
                ⚠️ This secret is required to complete the swap. Store it safely!
              </p>
            </div>
          </div>
        )}

        {/* Transaction Hash */}
        {swapState.txHash && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Transaction Hash</label>
            <div className="flex items-center space-x-2">
              <Input
                value={swapState.txHash}
                readOnly
                className="font-mono text-sm bg-slate-700/50 border-slate-600"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(swapState.txHash!, "Transaction Hash")}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://sepolia.etherscan.io/tx/${swapState.txHash}`, '_blank')}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Timelock */}
        {swapState.timelock && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Lock
            </label>
            <div className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3 border border-slate-600">
              <div>
                <p className="text-white text-sm">
                  Expires: {new Date(swapState.timelock * 1000).toLocaleString()}
                </p>
                <p className={`text-xs ${isExpired() ? 'text-red-400' : 'text-slate-400'}`}>
                  {isExpired() ? 'Expired - Refund available' : `Time remaining: ${getTimeRemaining()}`}
                </p>
              </div>
              {isExpired() && (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {swapState.error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-400">
              <XCircle className="w-4 h-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-red-300 text-sm mt-1">{swapState.error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3 pt-4 border-t border-slate-700">
          {/* Complete Swap */}
          {swapState.status === 'waiting_counterparty' && !isExpired() && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-300">Complete Swap</h4>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter secret to complete swap"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  className="flex-1 bg-slate-700/50 border-slate-600"
                />
                <Button
                  onClick={() => onComplete?.(swapState.swapId!, secretInput)}
                  disabled={!secretInput.trim() || !swapState.swapId}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Complete
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Enter the secret revealed by the counterparty to complete the swap
              </p>
            </div>
          )}

          {/* Refund Button */}
          {(swapState.status === 'waiting_counterparty' || swapState.status === 'failed') && 
           isExpired() && swapState.swapId && (
            <Button
              onClick={() => onRefund?.(swapState.swapId!)}
              variant="outline"
              className="w-full border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Refund Expired Swap
            </Button>
          )}

          {/* Reset Button */}
          {(swapState.status === 'completed' || swapState.status === 'refunded' || swapState.status === 'failed') && (
            <Button
              onClick={onReset}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Start New Swap
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}