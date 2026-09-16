// Radix compositions for the on-demand drawing tools. See NOTICE.md.
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as TogglePrimitive from "@radix-ui/react-toggle-group";
export function Slider({ label, ...props }) {
  return (
    <SliderPrimitive.Root className="ui-slider" {...props}>
      <SliderPrimitive.Track className="ui-slider-track">
        <SliderPrimitive.Range className="ui-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ui-slider-thumb" aria-label={label} />
    </SliderPrimitive.Root>
  );
}
export function ToggleGroup({
  value,
  onValueChange,
  label,
  options,
  disabled,
}) {
  return (
    <TogglePrimitive.Root
      className="ui-toggle-group"
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      aria-label={label}
      disabled={disabled}
    >
      {options.map(({ value: option, label: title, icon: Icon }) => (
        <TogglePrimitive.Item
          className="ui-toggle"
          value={option}
          key={option}
          aria-label={title}
        >
          {Icon && <Icon size={18} aria-hidden="true" />}
          <span>{title}</span>
        </TogglePrimitive.Item>
      ))}
    </TogglePrimitive.Root>
  );
}
