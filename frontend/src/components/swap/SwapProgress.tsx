import { Progress } from "../ui/progress";
export function SwapProgress({ progress, status }: { progress: number; status: string }) {
  return progress?(
    <div>
      <span className="block text-xs text-slate-300 mb-1">Status: {status}</span>
      <Progress value={progress} />
    </div>
  ):null;
}
