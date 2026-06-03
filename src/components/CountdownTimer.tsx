"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  deadlineTimestamp: number;
}

export default function CountdownTimer({ deadlineTimestamp }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const diff = deadlineTimestamp - now;

      if (diff <= 0) {
        setRemaining("Campaign ended");
        return;
      }

      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setRemaining(`${d}d ${h}h ${m}m ${s}s`);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineTimestamp]);

  return (
    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Time Remaining</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{remaining}</p>
    </div>
  );
}
