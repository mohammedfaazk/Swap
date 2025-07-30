import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SwapProgress } from "./SwapProgress";
import { DirectionToggle } from "./DirectionToggle";
import { PartialFillControls } from "./PartialFillControls";
import { useSwap } from "@/hooks/useSwap";
import { WalletConnection } from "@/components/wallet/WalletConnection";

export function SwapInterface() {
  const [direction, setDirection] = useState<"ETH_TO_XLM"|"XLM_TO_ETH">("ETH_TO_XLM");
  const [fromAmount, setFromAmount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [partial, setPartial] = useState(false);
  const [minimumFill, setMinimumFill] = useState("");
  const { initiateSwap, progress, status } = useSwap();

  return (
    <div className="space-y-6 p-8 bg-slate-800/60 rounded-lg shadow">
      <WalletConnection />
      <DirectionToggle direction={direction} onToggle={setDirection} />
      <Input value={fromAmount} onChange={e=>setFromAmount(e.target.value)} placeholder="Amount"/>
      <Input value={toAccount} onChange={e=>setToAccount(e.target.value)} placeholder={direction==="ETH_TO_XLM"?"Stellar address":"Ethereum address"}/>
      <PartialFillControls enabled={partial} setEnabled={setPartial} minimumFill={minimumFill} setMinimumFill={setMinimumFill}/>
      <Button type="button" onClick={()=>initiateSwap({direction,fromAmount,toAccount,partial,minimumFill})}>Initiate Atomic Swap</Button>
      <SwapProgress progress={progress} status={status}/>
    </div>
  );
}