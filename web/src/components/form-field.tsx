"use client";

import { useI18n } from "@/components/i18n-provider";

type FieldProps = {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
};

export function Field({ id, label, optional, error, hint, aside, children }: FieldProps) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          <span>{label}</span>
          {optional && <span className="text-[11px] normal-case tracking-normal text-charcoal/45">{t.common.optional}</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-signal">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-charcoal/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}
