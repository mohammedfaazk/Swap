export function Header() {
  return (
    <header className="w-full py-6 flex justify-between items-center bg-slate-900/80 px-8">
      <span className="text-2xl text-brand font-bold">StellarBridge Fusion+</span>
      <nav>
        <a href="/" className="mr-6">Swap</a>
        <a href="/analytics" className="mr-6">Analytics</a>
        <a href="/resolvers">Resolvers</a>
      </nav>
    </header>
  );
}
