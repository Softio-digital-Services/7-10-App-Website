import { Suspense } from "react";
import { OrdersBoard } from "@/components/admin/orders-board";

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <OrdersBoard />
    </Suspense>
  );
}
