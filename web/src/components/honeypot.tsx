/** Off-screen field people never see or reach; bots that fill every input give themselves away. */
export function Honeypot() {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="pointer-events-none absolute -start-[9999px] h-px w-px opacity-0"
    />
  );
}

export function honeypotValue(form: HTMLFormElement | null) {
  return (form?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
}
