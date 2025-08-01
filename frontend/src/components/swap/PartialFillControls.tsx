"use client";

export function PartialFillControls({enabled, setEnabled, minimumFill, setMinimumFill}:{enabled:boolean, setEnabled:any, minimumFill:string, setMinimumFill:any}) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-white">
        <input 
          type="checkbox" 
          checked={enabled} 
          onChange={e=>setEnabled(e.target.checked)}
          className="w-4 h-4 text-brand bg-slate-700 border-slate-600 rounded focus:ring-brand focus:ring-2"
        />
        <span>Enable Partial Fills</span>
      </label>
      {enabled && (
        <input 
          className="bg-slate-700 border border-slate-600 px-3 py-2 rounded text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" 
          type="number" 
          min="0" 
          value={minimumFill} 
          onChange={e=>setMinimumFill(e.target.value)} 
          placeholder="Minimum fill amount"
        />
      )}
    </div>
  );
}