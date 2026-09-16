// Adapted from shadcn/ui (MIT), see NOTICE.md.
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "./utils.js";

const variants = cva(
  "ui-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        ghost: "bg-transparent hover:bg-secondary",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
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
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </Component>
  );
});
