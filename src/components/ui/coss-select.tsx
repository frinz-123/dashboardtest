"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { useDialogContentContainer } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectGroupLabel = React.forwardRef<
  HTMLDivElement,
  SelectPrimitive.GroupLabel.Props
>(({ className, ...props }, ref) => (
  <SelectPrimitive.GroupLabel
    ref={ref}
    className={cn(
      "px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500",
      className,
    )}
    data-slot="select-group-label"
    {...props}
  />
));
SelectGroupLabel.displayName = "SelectGroupLabel";

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  SelectPrimitive.Value.Props
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn(
      "block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left leading-6",
      className,
    )}
    data-slot="select-value"
    {...props}
  />
));
SelectValue.displayName = "SelectValue";

const triggerSizeStyles = {
  sm: "min-h-10 px-3 text-sm",
  default: "min-h-11 px-3.5 text-base",
  lg: "min-h-12 px-4 text-base",
} as const;

type SelectTriggerProps = SelectPrimitive.Trigger.Props & {
  size?: keyof typeof triggerSizeStyles;
};

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  (
    { className, children, size = "default", type = "button", ...props },
    ref,
  ) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "group relative grid w-full grid-cols-[minmax(0,1fr)] items-center rounded-xl border border-slate-200 bg-white pe-11 text-left font-medium text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color,transform] duration-150 [transition-timing-function:cubic-bezier(0.215,0.61,0.355,1)] hover:border-slate-300 data-[popup-open]:border-slate-300 data-[popup-open]:shadow-md focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-300/70 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:transform-none",
        triggerSizeStyles[size],
        className,
      )}
      data-size={size}
      data-slot="select-trigger"
      type={type}
      {...props}
    >
      <span className="block min-w-0 overflow-hidden">{children}</span>
      <SelectPrimitive.Icon
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-[color,transform] duration-150 [transition-timing-function:cubic-bezier(0.215,0.61,0.355,1)] group-data-[popup-open]:rotate-180 group-data-[popup-open]:text-slate-600 motion-reduce:transition-none"
        data-slot="select-icon"
      >
        <ChevronDownIcon className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
);
SelectTrigger.displayName = "SelectTrigger";

type SelectPopupProps = SelectPrimitive.Popup.Props & {
  sideOffset?: number;
  alignItemWithTrigger?: boolean;
  portalContainer?: React.ComponentPropsWithoutRef<
    typeof SelectPrimitive.Portal
  >["container"];
};

const SelectPopup = React.forwardRef<HTMLDivElement, SelectPopupProps>(
  (
    {
      className,
      children,
      sideOffset = 4,
      alignItemWithTrigger = false,
      portalContainer,
      ...props
    },
    ref,
  ) => {
    const dialogContentContainer = useDialogContentContainer();

    return (
      <SelectPrimitive.Portal
        container={portalContainer ?? dialogContentContainer ?? undefined}
      >
        <SelectPrimitive.Positioner
          align="start"
          alignItemWithTrigger={alignItemWithTrigger}
          className="z-[9999]"
          style={{ pointerEvents: "auto" }}
          data-slot="select-positioner"
          sideOffset={sideOffset}
        >
          <SelectPrimitive.Popup
            ref={ref}
            style={{ pointerEvents: "auto" }}
            className={cn(
              "min-w-[var(--anchor-width)] max-w-[min(var(--available-width),24rem)] [transform-origin:var(--transform-origin)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)] outline-none [will-change:transform,opacity] transition-[opacity,transform] duration-180 [transition-timing-function:cubic-bezier(0.215,0.61,0.355,1)] data-[starting-style]:translate-y-1.5 data-[starting-style]:scale-[0.985] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-1 data-[ending-style]:scale-[0.985] data-[ending-style]:opacity-0 motion-reduce:transition-none",
              !alignItemWithTrigger && "origin-top-left",
              className,
            )}
            data-slot="select-popup"
            {...props}
          >
            <SelectPrimitive.ScrollUpArrow className="flex h-8 items-center justify-center bg-white text-slate-400">
              <ChevronDownIcon className="size-4 rotate-180" />
            </SelectPrimitive.ScrollUpArrow>
            <SelectPrimitive.List
              className="max-h-[min(var(--available-height),20rem)] overflow-y-auto p-1.5 pointer-events-auto"
              style={{ pointerEvents: "auto" }}
            >
              {children}
            </SelectPrimitive.List>
            <SelectPrimitive.ScrollDownArrow className="flex h-8 items-center justify-center bg-white text-slate-400">
              <ChevronDownIcon className="size-4" />
            </SelectPrimitive.ScrollDownArrow>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    );
  },
);
SelectPopup.displayName = "SelectPopup";

const SelectItem = React.forwardRef<HTMLElement, SelectPrimitive.Item.Props>(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "grid min-h-11 cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-2 text-base outline-none transition-[background-color,color] duration-150 [transition-timing-function:cubic-bezier(0.215,0.61,0.355,1)] data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 data-[selected]:text-slate-950 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 motion-reduce:transition-none pointer-events-auto",
        className,
      )}
      data-slot="select-item"
      style={{ pointerEvents: "auto" }}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="flex items-center justify-center text-slate-700">
        <CheckIcon className="size-4" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText
        className="col-start-2 truncate"
        data-slot="select-item-text"
      >
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  ),
);
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  SelectPrimitive.Separator.Props
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("mx-2 my-1 h-px bg-slate-200", className)}
    data-slot="select-separator"
    {...props}
  />
));
SelectSeparator.displayName = "SelectSeparator";

type SelectButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  size?: keyof typeof triggerSizeStyles;
};

const SelectButton = React.forwardRef<HTMLButtonElement, SelectButtonProps>(
  ({ className, size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-slate-300 focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-300/70 disabled:cursor-not-allowed disabled:opacity-60",
        triggerSizeStyles[size],
        className,
      )}
      data-size={size}
      data-slot="select-button"
      type={type}
      {...props}
    />
  ),
);
SelectButton.displayName = "SelectButton";

const SelectContent = SelectPopup;

export {
  Select,
  SelectButton,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
