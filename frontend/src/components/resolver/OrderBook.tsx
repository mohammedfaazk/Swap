import { useResolver } from "@/hooks/useResolver";
export function OrderBook() {
  const { orders } = useResolver();
  return (
    <div>
      <h2 className="font-semibold text-brand mb-2">Open Orders</h2>
      <ul>
        {orders.map((order, i) => (
          <li key={i} className="py-2 px-3 border-b border-slate-700 flex justify-between">
            <div>{order.amount} {order.fromToken} → {order.toToken} <br />
              <small className="text-xs text-slate-400">Order #{order.orderId}</small>
            </div>
            <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Take</button>
          </li>
        ))}
      </ul>
    </div>
  );
}