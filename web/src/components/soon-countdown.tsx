"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "@/components/countdown";

export function SoonCountdown({ target }: { target: string }) {
  const router = useRouter();
  const [openedAt] = useState(() => Date.now());
  const onDone = useCallback(() => {
    // Only move on when the countdown actually ran out on this page, otherwise forced "soon" mode would loop.
    if (openedAt < new Date(target).getTime()) router.replace("/");
  }, [openedAt, target, router]);
  return <Countdown target={target} onDone={onDone} />;
}
