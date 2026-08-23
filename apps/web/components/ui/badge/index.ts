import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Badge } from "./Badge.vue"

export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary-soft text-secondary-foreground [a&]:hover:bg-secondary-soft/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "text-foreground border-border [a&]:hover:bg-card [a&]:hover:text-foreground",
        approved:
          "border-transparent bg-primary-soft text-primary font-semibold [a&]:hover:bg-primary-soft/80",
        pending:
          "border-transparent bg-secondary-soft text-secondary-foreground font-semibold [a&]:hover:bg-secondary-soft/80",
        rejected:
          "border-transparent bg-destructive-soft text-destructive font-semibold [a&]:hover:bg-destructive-soft/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)
export type BadgeVariants = VariantProps<typeof badgeVariants>
