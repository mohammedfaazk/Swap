import Link from 'next/link';

export function Header() {
  return (
    <header className="w-full py-6 flex justify-between items-center bg-slate-900/80 px-8">
      <span className="text-2xl text-brand font-bold">StellarBridge Fusion+</span>
      <nav>
        <Link href="/" className="mr-6">Swap</Link>
        <Link href="/analytics" className="mr-6">Analytics</Link>
        <Link href="/resolvers">Resolvers</Link>
      </nav>
    </header>
  );
}
