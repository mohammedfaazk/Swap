export function Progress({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-brand-faint rounded my-2">
      <div className="h-2 rounded bg-brand transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}