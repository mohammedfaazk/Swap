export function PartialFillControls({enabled, setEnabled, minimumFill, setMinimumFill}:{enabled:boolean, setEnabled:any, minimumFill:string, setMinimumFill:any}) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
        <span>Partial fills</span>
      </label>
      {enabled && <input className="ml-2 bg-slate-700 px-2 py-1 rounded" type="number" min="0" value={minimumFill} onChange={e=>setMinimumFill(e.target.value)} placeholder="Min fill"/>}
    </div>
  );
}