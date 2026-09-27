"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createLocalStore, useHydrated, useLocalStore } from "@/lib/local-store";
import type { CartItem } from "@/types/store";

const EMPTY: CartItem[] = [];
const bag = createLocalStore<CartItem[]>("710.bag.v1", EMPTY, (value) => (Array.isArray(value) ? (value as CartItem[]) : null));

type AddResult = "added" | "capped" | "unavailable";

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  drawerOpen: boolean;
  lastAddedId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number, options?: { open?: boolean }) => AddResult;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  syncStock: (stock: Record<string, number>, prices?: Record<string, { price: number; compareAt: number | null }>) => void;
  refresh: () => Promise<void>;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useLocalStore(bag);
  const ready = useHydrated();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const addItem = useCallback<CartContextValue["addItem"]>((item, quantity = 1, options) => {
    if (item.maxStock <= 0) return "unavailable";
    const existing = bag.get().find((i) => i.variantId === item.variantId);
    const wanted = (existing?.quantity ?? 0) + quantity;
    const next = Math.min(wanted, item.maxStock);
    const result: AddResult = next < wanted ? "capped" : "added";
    bag.set((current) => {
      const found = current.some((i) => i.variantId === item.variantId);
      return found
        ? current.map((i) => (i.variantId === item.variantId ? { ...i, ...item, quantity: next } : i))
        : [...current, { ...item, quantity: next }];
    });
    setLastAddedId(item.variantId);
    if (options?.open !== false) setDrawerOpen(true);
    return result;
  }, []);

  const removeItem = useCallback((variantId: string) => {
    bag.set((current) => current.filter((i) => i.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    bag.set((current) =>
      quantity <= 0
        ? current.filter((i) => i.variantId !== variantId)
        : current.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.min(quantity, Math.max(1, i.maxStock)) } : i,
          ),
    );
  }, []);

  const syncStock = useCallback<CartContextValue["syncStock"]>((stock, prices) => {
    bag.set((current) =>
      current
        .map((i) => {
          const available = stock[i.variantId];
          const live = prices?.[i.variantId];
          const next = live ? { ...i, price: live.price, compareAt: live.compareAt } : i;
          if (available === undefined) return next;
          return { ...next, maxStock: available, quantity: Math.min(i.quantity, available) };
        })
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const refresh = useCallback(async () => {
    const variantIds = bag.get().map((i) => i.variantId);
    if (variantIds.length === 0) return;
    try {
      const res = await fetch("/api/bag/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantIds }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.stock) syncStock(data.stock, data.prices);
    } catch {
      /* offline — keep the local bag as is */
    }
  }, [syncStock]);

  const clearCart = useCallback(() => bag.set(EMPTY), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return {
      items,
      ready,
      count,
      subtotal,
      drawerOpen,
      lastAddedId,
      openDrawer,
      closeDrawer,
      addItem,
      removeItem,
      updateQuantity,
      syncStock,
      refresh,
      clearCart,
    };
  }, [items, ready, drawerOpen, lastAddedId, openDrawer, closeDrawer, addItem, removeItem, updateQuantity, syncStock, refresh, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
