export function shortAddr(addr: string|undefined) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";
}
export function formatNumber(x: number) {
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}