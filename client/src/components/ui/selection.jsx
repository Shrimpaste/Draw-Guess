// Adapted from shadcn/ui primitives (MIT), see NOTICE.md.
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as TogglePrimitive from "@radix-ui/react-toggle-group";
import { Check } from "lucide-react";

export function Slider({ label, ...props }) {
  return <SliderPrimitive.Root className="ui-slider" {...props}><SliderPrimitive.Track className="ui-slider-track"><SliderPrimitive.Range className="ui-slider-range" /></SliderPrimitive.Track><SliderPrimitive.Thumb className="ui-slider-thumb" aria-label={label} /></SliderPrimitive.Root>;
}
export function RadioCards({ value, onValueChange, options, label, disabled }) {
  return <RadioPrimitive.Root className="ui-radio-cards" value={value} onValueChange={onValueChange} aria-label={label} disabled={disabled}>{options.map(({ value: option, title, description }) => <RadioPrimitive.Item className="ui-radio-card" value={option} key={option}><span className="radio-title">{title}<span className="radio-dot"><RadioPrimitive.Indicator /></span></span>{description && <span className="radio-description">{description}</span>}</RadioPrimitive.Item>)}</RadioPrimitive.Root>;
}
export function Checkbox({ label, ...props }) {
  return <CheckboxPrimitive.Root className="ui-checkbox" aria-label={label} {...props}><CheckboxPrimitive.Indicator><Check size={14} /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
export function ToggleGroup({ value, onValueChange, label, options, disabled }) {
  return <TogglePrimitive.Root className="ui-toggle-group" type="single" value={value} onValueChange={(next) => { if (next) onValueChange(next); }} aria-label={label} disabled={disabled}>{options.map(({ value: option, label: title, icon: Icon }) => <TogglePrimitive.Item className="ui-toggle" value={option} key={option} aria-label={title}>{Icon && <Icon size={18} aria-hidden="true" />}<span>{title}</span></TogglePrimitive.Item>)}</TogglePrimitive.Root>;
}
