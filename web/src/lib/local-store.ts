"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

export type LocalStore<T> = {
  get: () => T;
  getServer: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: Listener) => () => void;
};

/**
 * A localStorage-backed value for useSyncExternalStore: renders `fallback` on the server and during hydration,
 * then the stored value, and stays in sync across tabs.
 */
export function createLocalStore<T>(key: string, fallback: T, parse: (value: unknown) => T | null): LocalStore<T> {
  const listeners = new Set<Listener>();
  let cachedRaw: string | null | undefined;
  let cachedValue = fallback;
  let memoryOnly = false;

  function get(): T {
    if (memoryOnly) return cachedValue;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return cachedValue;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedValue = fallback;
      if (raw !== null) {
        try {
          cachedValue = parse(JSON.parse(raw)) ?? fallback;
        } catch {
          /* malformed entry — fall back */
        }
      }
    }
    return cachedValue;
  }

  function set(next: T | ((prev: T) => T)) {
    const value = typeof next === "function" ? (next as (prev: T) => T)(get()) : next;
    const raw = JSON.stringify(value);
    try {
      localStorage.setItem(key, raw);
    } catch {
      memoryOnly = true;
    }
    cachedRaw = raw;
    cachedValue = value;
    listeners.forEach((l) => l());
  }

  function subscribe(listener: Listener) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { get, getServer: () => fallback, set, subscribe };
}

export function useLocalStore<T>(store: LocalStore<T>) {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
