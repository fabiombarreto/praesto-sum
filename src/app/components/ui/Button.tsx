// Owned component (ADR-0011) over Base UI's Button, styled with the Arcade tokens
// (ADR-0010) through Tailwind: the primary variant carries the 3 px lower face and
// sinks 3 px on press; the icon variant is a 48 px hit area.

import { Button as BaseButton } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-4 font-text text-t2 font-semibold transition-transform duration-150 ease-out select-none disabled:opacity-55",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-on-accent shadow-control active:translate-y-[3px] active:shadow-control-pressed",
        secondary: "border border-line bg-surface-2 text-ink",
        ghost: "bg-transparent text-accent",
        icon: "size-12 bg-transparent px-0 text-ink",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type ButtonProps = React.ComponentProps<typeof BaseButton> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return <BaseButton className={cn(buttonVariants({ variant }), className)} {...props} />;
}
