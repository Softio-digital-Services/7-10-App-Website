"use client";

import { useEffect } from "react";

let locks = 0;

export function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.paddingInlineEnd = `${scrollbar}px`;
    return () => {
      locks -= 1;
      if (locks === 0) {
        html.style.overflow = "";
        html.style.paddingInlineEnd = "";
      }
    };
  }, [active]);
}
