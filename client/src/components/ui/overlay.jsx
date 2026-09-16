// Composition adapted from shadcn/ui Dialog / Popover / AlertDialog (MIT).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { useRef } from "react";
import { Button } from "./button.jsx";
import { cn } from "./utils.js";

export function Modal({
  title,
  description,
  children,
  open = true,
  onOpenChange,
  className,
  initialFocusRef,
  onCloseAutoFocus,
}) {
  const previousFocus = useRef(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-overlay" />
        <DialogPrimitive.Content
          className={cn("ui-dialog", className)}
          onCloseAutoFocus={(event) => {
            if (onCloseAutoFocus) onCloseAutoFocus(event);
            else if (previousFocus.current?.isConnected) {
              event.preventDefault();
              previousFocus.current.focus();
            }
          }}
          onOpenAutoFocus={(event) => {
            previousFocus.current = document.activeElement;
            if (initialFocusRef) {
              event.preventDefault();
              initialFocusRef.current?.focus();
            }
          }}
          {...(!description ? { "aria-describedby": undefined } : {})}
        >
          <header className="ui-dialog-header">
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description>
                {description}
              </DialogPrimitive.Description>
            )}
          </header>
          {children}
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="dialog-close"
              aria-label="关闭弹窗"
            >
              <X />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function ConfirmAction({
  children,
  title,
  description,
  onConfirm,
  confirmText = "确认",
  disabled = false,
}) {
  return (
    <AlertPrimitive.Root>
      <AlertPrimitive.Trigger asChild>{children}</AlertPrimitive.Trigger>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className="ui-overlay" />
        <AlertPrimitive.Content className="ui-dialog ui-confirm">
          <header className="ui-dialog-header">
            <AlertPrimitive.Title>{title}</AlertPrimitive.Title>
            <AlertPrimitive.Description>
              {description}
            </AlertPrimitive.Description>
          </header>
          <footer className="ui-dialog-footer">
            <AlertPrimitive.Cancel asChild>
              <Button variant="outline">取消</Button>
            </AlertPrimitive.Cancel>
            <AlertPrimitive.Action asChild>
              <Button
                variant="destructive"
                disabled={disabled}
                onClick={onConfirm}
              >
                {confirmText}
              </Button>
            </AlertPrimitive.Action>
          </footer>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
