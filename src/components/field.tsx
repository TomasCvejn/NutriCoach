import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

// Label above the field, then the hint or the error (the field points at it with aria-describedby="<id>-note").
export function Field({ id, label, hint, error, className, children }: { id: string; label: string; hint?: string; error?: string; className?: string; children: ReactNode }) {
  const note = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {note && (
        <p id={`${id}-note`} className={error ? "text-xs text-destructive-ink" : "text-xs text-muted-foreground"}>
          {note}
        </p>
      )}
    </div>
  );
}
