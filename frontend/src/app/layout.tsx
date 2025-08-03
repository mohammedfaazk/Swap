import "@/app/globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { StellarWalletProvider } from "@/components/wallet/StellarWalletProvider";
import { NotificationProvider } from "@/components/ui/notification";

export const metadata = {
  title: 'StellarBridge Fusion+ | Cross-Chain Atomic Swaps',
  description: 'Professional cross-chain atomic swaps between Ethereum and Stellar networks',
};

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased min-h-screen">
        <div id="__next" className="h-full">
          <NotificationProvider>
            <WalletProvider>
              <StellarWalletProvider>
                <main className="h-full">
                  {children}
                </main>
              </StellarWalletProvider>
            </WalletProvider>
          </NotificationProvider>
        </div>
      </body>
    </html>
  );
}