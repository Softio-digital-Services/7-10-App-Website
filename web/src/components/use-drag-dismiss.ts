"use client";

import { useEffect, useRef } from "react";

/** Where a flick would come to rest — the exponential-decay projection iOS uses for scroll deceleration. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary, so an edge feels soft instead of frozen. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Pointer velocity (px/s) along x from the last ~100ms of samples. */
export function velocityX(samples: { x: number; t: number }[]) {
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;
}

const SLOP = 10;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
// The initial slope of EASE, used to start the settle at the finger's release speed.
const EASE_SLOPE = 4.5;

type Drag = {
  id: number;
  x0: number;
  y0: number;
  axis: "x" | "y" | null;
  base: number;
  offset: number;
  width: number;
  samples: { x: number; t: number }[];
};

/**
 * Swipe a side drawer closed. The panel tracks the finger 1:1, rubber-bands when pulled open,
 * projects the release momentum to decide close vs. stay, and hands the release velocity to the
 * settle animation. Touch and pen only — mouse users have the close button, backdrop and Escape.
 */
export function useDragDismiss<P extends HTMLElement, B extends HTMLElement>({
  side,
  dir,
  onClose,
}: {
  side: "start" | "end";
  dir: "ltr" | "rtl";
  onClose: () => void;
}) {
  const panelRef = useRef<P>(null);
  const backdropRef = useRef<B>(null);
  const drag = useRef<Drag | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDragged = useRef(false);

  // +1 when "closed" sits to the right of the panel, -1 when it sits to the left.
  const closeSign = (side === "end") === (dir === "ltr") ? 1 : -1;

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const paint = (visual: number, width: number) => {
    const panel = panelRef.current;
    if (panel) panel.style.transform = `translateX(${visual * closeSign}px)`;
    const backdrop = backdropRef.current;
    if (backdrop) backdrop.style.opacity = String(1 - Math.min(1, Math.max(0, visual / width)));
  };

  const clearInline = () => {
    for (const el of [panelRef.current, backdropRef.current]) {
      if (!el) continue;
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, base: 0, offset: 0, width: 1, samples: [] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || d.id !== e.pointerId || !panel) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;

    if (!d.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "y") return;
      // Grab from the on-screen position, so catching a settling drawer never jumps.
      if (settleTimer.current) clearTimeout(settleTimer.current);
      d.base = new DOMMatrix(getComputedStyle(panel).transform).m41 * closeSign;
      d.width = panel.offsetWidth;
      d.x0 = e.clientX;
      panel.setPointerCapture(e.pointerId);
      panel.style.transition = "none";
      if (backdropRef.current) backdropRef.current.style.transition = "none";
    }
    if (d.axis !== "x") return;

    const raw = d.base + (e.clientX - d.x0) * closeSign;
    d.offset = raw >= 0 ? raw : -rubberband(-raw, d.width);
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 8) d.samples.shift();
    paint(d.offset, d.width);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.axis !== "x") return;
    justDragged.current = true;
    requestAnimationFrame(() => (justDragged.current = false));

    const v = d.samples.length > 1 ? velocityX(d.samples) * closeSign : 0;
    const close = e.type !== "pointercancel" && d.offset + project(v) > d.width / 2;
    const remaining = Math.abs((close ? d.width : 0) - d.offset);
    const ms = Math.min(500, Math.max(200, Math.abs(v) > 1 ? (EASE_SLOPE * remaining * 1000) / Math.abs(v) : 450));

    for (const [el, prop] of [[panelRef.current, "transform"], [backdropRef.current, "opacity"]] as const) {
      if (el) el.style.transition = `${prop} ${ms}ms ${EASE}`;
    }
    if (close) {
      paint(d.width, d.width);
      onClose();
    } else {
      paint(0, d.width);
    }
    settleTimer.current = setTimeout(clearInline, ms + 50);
  };

  // A drag that ends over a link must not also follow it.
  const onClickCapture = (e: React.MouseEvent) => {
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    panelRef,
    backdropRef,
    panelProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
      style: { touchAction: "pan-y" } as React.CSSProperties,
    },
  };
}
