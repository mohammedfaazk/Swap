import "@/app/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>StellarBridge Fusion+ | Cross-Chain Atomic Swaps</title>
        <meta name="description" content="Professional cross-chain atomic swaps between Ethereum and Stellar networks" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}