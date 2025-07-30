import { useSwap } from "@/hooks/useSwap";
export function SwapHistory() {
  const { history } = useSwap();
  return (
    <div>
      <h4 className="font-bold mb-2">Swap History</h4>
      <ul>{history.map((s, i) => <li key={i}>{s.direction}: {s.fromAmount}</li>)}</ul>
    </div>
  );
}