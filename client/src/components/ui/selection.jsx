// Adapted from shadcn/ui primitives (MIT), see NOTICE.md.
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { SketchIcon } from "./sketch-icon.jsx";
import { SketchMark } from "./sketch-mark.jsx";

export function RadioCards({ value, onValueChange, options, label, disabled }) {
  return (
    <RadioPrimitive.Root
      className="ui-radio-cards"
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      disabled={disabled}
    >
      {options.map(({ value: option, title, description, art }) => (
        <RadioPrimitive.Item
          className="ui-radio-card"
          value={option}
          key={option}
        >
          {art && (
            <span className="radio-art" aria-hidden="true">
              {art}
              <SketchMark />
            </span>
          )}
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
        <SketchIcon name="check" size={15} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
