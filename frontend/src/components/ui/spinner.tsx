import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const spinnerVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center text-current",
  {
    variants: {
      size: {
        sm: "size-3.5",
        md: "size-5",
        lg: "size-8",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

function Spinner({
  className,
  size,
  label = "Loading",
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof spinnerVariants> & {
    label?: string;
  }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <span
        className="loader-spinner-glow absolute inset-0 rounded-full bg-current"
        aria-hidden
      />
      <span
        className="loader-spinner-core absolute inset-[24%] rounded-full bg-current"
        aria-hidden
      />
    </span>
  );
}

export { Spinner, spinnerVariants };
