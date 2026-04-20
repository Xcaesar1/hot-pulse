"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const beamPositions = ["6%", "18%", "32%", "49%", "63%", "78%", "91%"];

export function BackgroundBeams({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(51,181,229,0.12),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.1),transparent_22%)]" />
      {beamPositions.map((left, index) => (
        <motion.span
          key={left}
          className="absolute top-[-10%] h-[120%] w-px bg-[linear-gradient(180deg,transparent,rgba(56,189,248,0.28),transparent)]"
          style={{ left }}
          animate={{ y: ["-6%", "6%", "-6%"], opacity: [0.2, 0.75, 0.2] }}
          transition={{
            duration: 7 + index,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: index * 0.35
          }}
        />
      ))}
      <motion.div
        className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full border border-cyan-300/10"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 28, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      >
        <div className="absolute inset-7 rounded-full border border-cyan-300/10" />
        <div className="absolute inset-14 rounded-full border border-cyan-300/10" />
      </motion.div>
    </div>
  );
}
