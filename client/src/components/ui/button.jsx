// Adapted from shadcn/ui (MIT), see NOTICE.md. Variants map to paper-and-ink styles in ui.css.
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "./utils.js";

const variants = cva("ui-button", {
  variants: {
    variant: {
      default: "ui-button-primary",
      outline: "ui-button-outline",
      secondary: "ui-button-secondary",
      ghost: "ui-button-ghost",
      destructive: "ui-button-destructive",
    },
    size: {
      default: "",
      sm: "ui-button-sm",
      lg: "ui-button-lg",
      icon: "ui-button-icon",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export const Button = forwardRef(function Button(
  { className, variant, size, asChild, pending, disabled, children, ...props },
  ref,
) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : "button"}
      className={cn(variants({ variant, size }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <span className="ui-spinner" aria-hidden="true" />}
      {children}
    </Component>
  );
});
