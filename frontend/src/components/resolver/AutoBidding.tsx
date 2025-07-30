export function AutoBidding() {
  return (
    <div>
      <h2 className="font-semibold text-brand mb-2">Auto-Bidding</h2>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={true} readOnly />
        <span>Enable Auto-Bid for Dutch Auctions</span>
      </div>
    </div>
  );
}