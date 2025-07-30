import { OrderBook } from "./OrderBook";
import { AuctionView } from "./AuctionView";
import { ProfitCalculator } from "./ProfitCalculator";
import { AutoBidding } from "./AutoBidding";
import { Card } from "../ui/card";
export function ResolverDashboard() {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card><OrderBook /></Card>
      <Card><AuctionView /></Card>
      <Card><ProfitCalculator /></Card>
      <Card><AutoBidding /></Card>
    </div>
  );
}
