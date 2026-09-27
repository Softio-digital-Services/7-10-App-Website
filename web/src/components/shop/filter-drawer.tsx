"use client";

import { useEffect } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useLockBody } from "@/components/use-lock-body";
import type { SortKey } from "@/lib/catalog";
import type { ShopFilters } from "@/components/shop/shop-view";

type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  sizes: string[];
  filters: ShopFilters;
  total: number;
  pending: boolean;
  sortOptions: { value: SortKey; label: string }[];
  onChange: (patch: Partial<ShopFilters>) => void;
  onClear: () => void;
};

export function FilterDrawer({ open, onClose, sizes, filters, total, pending, sortOptions, onChange, onClear }: FilterDrawerProps) {
  const { t, f } = useI18n();
  useLockBody(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleSize = (size: string) =>
    onChange({ sizes: filters.sizes.includes(size) ? filters.sizes.filter((s) => s !== size) : [...filters.sizes, size] });

  const refinements = filters.sizes.length + Number(filters.inStock) + Number(filters.sale);

  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
      role="dialog"
      aria-modal="true"
      aria-label={t.shop.filter}
    >
      <div className={`absolute inset-0 bg-charcoal/45 transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`absolute inset-y-0 start-0 flex w-full max-w-[420px] flex-col bg-cream transition-transform duration-700 ease-[var(--ease-out-expo)] ${
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-charcoal/10 px-6 md:h-[76px]">
          <p className="display text-2xl">
            {t.shop.filter}
            {refinements > 0 && <span className="ms-2 font-display text-base text-charcoal/40" dir="ltr">({refinements})</span>}
          </p>
          <button type="button" onClick={onClose} className="-me-2 grid h-11 w-11 place-items-center" aria-label={t.common.close}>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <FilterSection title={t.shop.sort}>
            <div className="grid gap-1">
              {sortOptions.map((o) => {
                const active = filters.sort === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange({ sort: o.value })}
                    aria-pressed={active}
                    className="flex items-center justify-between py-2 text-start text-[15px]"
                  >
                    <span className={active ? "font-medium" : "text-charcoal/70"}>{o.label}</span>
                    <span className={`grid h-5 w-5 place-items-center rounded-full border ${active ? "border-charcoal" : "border-charcoal/25"}`}>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-charcoal" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {sizes.length > 0 && (
            <FilterSection title={t.shop.size}>
              <div className="grid grid-cols-4 gap-2" dir="ltr">
                {sizes.map((s) => {
                  const active = filters.sizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      aria-pressed={active}
                      className={`h-12 font-display text-[13px] tracking-wider transition-colors ${
                        active ? "bg-charcoal text-cream" : "border border-charcoal/20 hover:border-charcoal"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </FilterSection>
          )}

          <FilterSection title={t.shop.availability}>
            <Toggle checked={filters.inStock} onChange={(v) => onChange({ inStock: v })} label={t.shop.inStockOnly} />
          </FilterSection>

          <FilterSection title={t.shop.offers} last>
            <Toggle checked={filters.sale} onChange={(v) => onChange({ sale: v })} label={t.shop.onSale} />
          </FilterSection>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-4 border-t border-charcoal/10 px-6 py-5">
          <button
            type="button"
            onClick={onClear}
            disabled={refinements === 0}
            className="text-[14px] underline underline-offset-4 disabled:text-charcoal/30 disabled:no-underline"
          >
            {t.shop.clear}
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary w-full">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {f(t.shop.apply, { n: total })}
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section className={`py-6 ${last ? "" : "border-b border-charcoal/10"}`}>
      <h3 className="eyebrow mb-4 text-charcoal/55">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between py-1 text-[15px]">
      {label}
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-olive" : "bg-charcoal/15"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-all duration-300 ${
            checked ? "start-[22px]" : "start-0.5"
          }`}
        />
      </span>
    </button>
  );
}
