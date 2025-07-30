export function ProfitCalculator() {
  return (
    <div>
      <h2 className="font-semibold text-brand mb-2">Profit Calculator</h2>
      <div className="flex gap-2">
        <input type="number" className="bg-slate-700 px-2 py-1 rounded text-white w-24" placeholder="Fill Amt"/>
        <span>→</span>
        <input type="number" className="bg-slate-700 px-2 py-1 rounded text-white w-24" placeholder="Profit"/>
      </div>
    </div>
  );
}
