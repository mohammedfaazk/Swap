import { useResolver } from "@/hooks/useResolver";
export function AuctionView() {
  const { auctions } = useResolver();
  return (
    <div>
      <h2 className="font-semibold text-brand mb-2">Live Auctions</h2>
      <ul>
        {auctions.map((auction, i) => (
          <li key={i} className="py-2">{auction.details}</li>
        ))}
      </ul>
    </div>
  );
}