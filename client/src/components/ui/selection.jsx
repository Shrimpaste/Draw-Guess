// Adapted from shadcn/ui primitives (MIT), see NOTICE.md.
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

export function RadioCards({ value, onValueChange, options, label, disabled }) {
  return (
    <RadioPrimitive.Root
      className="ui-radio-cards"
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      disabled={disabled}
    >
      {options.map(({ value: option, title, description }) => (
        <RadioPrimitive.Item
          className="ui-radio-card"
          value={option}
          key={option}
        >
          <span className="radio-title">
            {title}
            <span className="radio-dot">
              <RadioPrimitive.Indicator />
            </span>
          </span>
          {description && (
            <span className="radio-description">{description}</span>
          )}
        </RadioPrimitive.Item>
      ))}
    </RadioPrimitive.Root>
  );
}
export function Checkbox({ label, ...props }) {
  return (
    <CheckboxPrimitive.Root
      className="ui-checkbox"
      aria-label={label}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check size={14} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
