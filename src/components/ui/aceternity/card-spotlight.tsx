"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardSpotlightProps extends HTMLAttributes<HTMLDivElement> {
  radius?: number;
  color?: string;
}

export function CardSpotlight({
  className,
  children,
  radius = 240,
  color = "rgba(51, 181, 229, 0.16)",
  onPointerMove,
  onPointerLeave,
  style,
  ...props
}: CardSpotlightProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] backdrop-blur-xl",
        className
      )}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--spotlight-x", "50%");
        event.currentTarget.style.setProperty("--spotlight-y", "50%");
        onPointerLeave?.(event);
      }}
      style={
        {
          "--spotlight-radius": `${radius}px`,
          "--spotlight-color": color,
          ...style
        } as CSSProperties
      }
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition duration-500 group-hover:opacity-100">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(var(--spotlight-radius) circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), var(--spotlight-color), transparent 48%)"
          }}
        />
      </div>
      <div className="absolute inset-[1px] rounded-[calc(28px-1px)] bg-[linear-gradient(180deg,rgba(12,18,28,0.94),rgba(7,10,18,0.92))]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
