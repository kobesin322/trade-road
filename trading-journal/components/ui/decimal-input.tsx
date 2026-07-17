import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DecimalInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode"
>;

/** Free-text numeric input — allows `-`, `.`, and partial values while typing. */
export function DecimalInput({ className, ...props }: DecimalInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn("font-mono tabular-nums", className)}
      {...props}
    />
  );
}
