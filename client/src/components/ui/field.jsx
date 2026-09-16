// Input styling adapted from shadcn/ui (MIT), see NOTICE.md.
import { forwardRef, useId } from "react";
import { cn } from "./utils.js";

const fieldStyle =
  "ui-input flex w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base shadow-xs transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-55 md:text-sm";
export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input ref={ref} className={cn(fieldStyle, "h-11", className)} {...props} />
  );
});
export const Textarea = forwardRef(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldStyle, "min-h-24 py-3", className)}
      {...props}
    />
  );
});
export function Field({
  id: providedId,
  label,
  hint,
  error,
  children,
  className,
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  return (
    <div className={cn("ui-field", className)}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-invalid": !!error,
        "aria-describedby": hint || error ? `${id}-help` : undefined,
      })}
      {(error || hint) && (
        <p
          id={`${id}-help`}
          className={error ? "field-error" : "field-hint"}
          role={error ? "alert" : undefined}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
