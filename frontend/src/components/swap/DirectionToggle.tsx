"use client";

import { Button } from "../ui/button";
export function DirectionToggle({ direction, onToggle }: { direction: "ETH_TO_XLM"|"XLM_TO_ETH", onToggle: (d:"ETH_TO_XLM"|"XLM_TO_ETH")=>void }) {
  return (
    <div className="flex items-center space-x-4">
      <Button type="button" onClick={()=>onToggle("ETH_TO_XLM")} className={direction==="ETH_TO_XLM"?"opacity-100":"opacity-60"}>ETH→XLM</Button>
      <Button type="button" onClick={()=>onToggle("XLM_TO_ETH")} className={direction==="XLM_TO_ETH"?"opacity-100":"opacity-60"}>XLM→ETH</Button>
    </div>
  );
}