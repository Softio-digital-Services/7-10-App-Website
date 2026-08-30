"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
};

const statuses = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => res.json())
      .then(setOrders)
      .catch(() => setMessage("Could not load orders"));
  }, []);

  async function updateStatus(orderId: string, status: string) {
    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });

    if (!response.ok) {
      setMessage("Update failed");
      return;
    }

    const updated = await response.json();
    setOrders((current) =>
      current.map((order) => (order.id === updated.id ? updated : order)),
    );
    setMessage(`Order ${updated.orderNumber} updated. Customer emailed.`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Orders</h1>
      {message && <p className="mt-2 text-sm text-stone-600">{message}</p>}

      <div className="mt-8 space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-sm text-stone-600">
                  {order.customerName} — {order.customerEmail}
                </p>
              </div>
              <p className="font-medium">${order.total.toFixed(2)}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                Payment: {order.paymentStatus}
              </span>
              <select
                value={order.status}
                onChange={(e) => updateStatus(order.id, e.target.value)}
                className="rounded-full border border-stone-300 px-3 py-1 text-sm"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
