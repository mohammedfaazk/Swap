"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";  
import { AlertTriangle, DollarSign, Clock, Shield } from "lucide-react";

interface RealTransactionWarningProps {
  amount: string;
  destinationAddress: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RealTransactionWarning({ 
  amount, 
  destinationAddress, 
  onConfirm, 
  onCancel 
}: RealTransactionWarningProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Card className="bg-red-900/20 border-red-500/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <div>
            <CardTitle className="text-red-100">⚠️ REAL CRYPTOCURRENCY TRANSACTION</CardTitle>
            <CardDescription className="text-red-300">
              This will move actual ETH from your wallet on Sepolia testnet
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Transaction Details */}
        <div className="bg-red-800/30 rounded-lg p-4 border border-red-500/30">
          <h3 className="text-red-100 font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Transaction Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-red-300">Amount to Lock:</span>
              <span className="text-red-100 font-mono">{amount} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-300">Destination:</span>
              <span className="text-red-100 font-mono text-xs">
                {destinationAddress.slice(0, 10)}...{destinationAddress.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-300">Network:</span>
              <span className="text-red-100">Sepolia Testnet</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-300">Est. Gas Fee:</span>
              <span className="text-red-100">~0.003 ETH</span>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
          <h3 className="text-yellow-100 font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            How This Works
          </h3>
          <div className="space-y-2 text-xs text-yellow-200">
            <p>1. Your ETH will be locked in an HTLC (Hash Time Lock Contract)</p>
            <p>2. The recipient can claim it by revealing the secret within 24 hours</p>
            <p>3. If unclaimed, you can refund your ETH after the timelock expires</p>
            <p>4. This creates a trustless atomic swap mechanism</p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/30">
          <h3 className="text-blue-100 font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security Notice
          </h3>
          <div className="space-y-2 text-xs text-blue-200">
            <p>✅ This is Sepolia testnet - no real money at risk</p>
            <p>✅ Contract is audited and uses OpenZeppelin security patterns</p>
            <p>✅ You can always refund if the swap isn't completed</p>
            <p>✅ Your private keys never leave your wallet</p>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="flex items-start space-x-3 p-4 bg-slate-800/50 rounded-lg border border-slate-600">
          <input
            type="checkbox"
            id="confirm-real-tx"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 mt-1 text-red-600 bg-slate-700 border-slate-600 rounded focus:ring-red-500"
          />
          <label htmlFor="confirm-real-tx" className="text-sm text-slate-300">
            I understand this will execute a <strong className="text-red-400">real blockchain transaction</strong> that 
            will lock <strong className="text-red-400">{amount} ETH</strong> from my wallet on Sepolia testnet. 
            I have reviewed the destination address and transaction details.
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirmed}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            🚀 Execute Real Transaction
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center">
          By proceeding, you acknowledge that this will interact with the Ethereum blockchain
        </p>
      </CardContent>
    </Card>
  );
}