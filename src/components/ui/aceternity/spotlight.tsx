"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SpotlightProps {
  className?: string;
  gradientFirst?: string;
  gradientSecond?: string;
  gradientThird?: string;
}

export function Spotlight({
  className,
  gradientFirst = "radial-gradient(46% 46% at 50% 50%, rgba(64, 196, 255, 0.22) 0%, rgba(64, 196, 255, 0.08) 45%, transparent 72%)",
  gradientSecond = "radial-gradient(46% 46% at 50% 50%, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0.05) 46%, transparent 72%)",
  gradientThird = "radial-gradient(46% 46% at 50% 50%, rgba(125, 211, 252, 0.12) 0%, rgba(125, 211, 252, 0.02) 50%, transparent 72%)"
}: SpotlightProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <motion.div
        className="absolute -left-24 top-[-18rem] h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ backgroundImage: gradientFirst }}
        animate={{ x: [-20, 20, -10], y: [0, 30, 0], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-8rem] top-[-16rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ backgroundImage: gradientSecond }}
        animate={{ x: [10, -20, 10], y: [20, -10, 20], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-[30%] top-12 h-[24rem] w-[24rem] rounded-full blur-3xl"
        style={{ backgroundImage: gradientThird }}
        animate={{ x: [0, 25, 0], y: [10, -20, 10], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
    </div>
  );
}
