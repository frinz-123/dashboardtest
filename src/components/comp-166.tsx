import { useId } from "react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface CleyOrderQuestionProps {
  onChange?: (value: string) => void;
  value?: string;
}

export default function CleyOrderQuestion({ onChange, value = "1" }: CleyOrderQuestionProps) {
  const id = useId()

  const items = [{ value: "1", label: "No, no levanté pedido" }, { value: "2", label: "Si, Levanté pedido" }]

  return (
    <fieldset className="space-y-4">
      <legend className="text-foreground text-sm leading-none font-medium">Levantaste pedido en Casa Ley?</legend>
      <RadioGroup 
        className="gap-0 -space-y-px rounded-md shadow-xs" 
        defaultValue={value}
        value={value}
        onValueChange={onChange}
      >
        {items.filter(Boolean).map((item) => item && (
          <div
            key={`${id}-${item.value}`}
            className="border-input has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-accent relative flex flex-col gap-4 border p-4 outline-none first:rounded-t-md last:rounded-b-md has-data-[state=checked]:z-10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  id={`${id}-${item.value}`}
                  value={item.value}
                  className="after:absolute after:inset-0"
                  aria-describedby={`${`${id}-${item.value}`}-price`}
                />
                <Label className="inline-flex items-start" htmlFor={`${id}-${item.value}`}>
                  {item.label}
                </Label>
              </div>
              <div id={`${`${id}-${item.value}`}-price`} className="text-muted-foreground text-xs leading-[inherit]">
                {/* Removed price since it doesn't exist in the items array */}
              </div>
            </div>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  )
}
