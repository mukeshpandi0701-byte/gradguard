import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary via-accent to-secondary text-primary-foreground shadow-elevated hover:shadow-glow-strong hover:scale-110 active:scale-95 hover:-translate-y-1 gradient-shift before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
        destructive: "bg-gradient-to-r from-destructive to-red-600 text-destructive-foreground shadow-md hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:scale-110 active:scale-95 hover:-translate-y-1",
        outline: "border-2 border-primary/30 bg-background/50 backdrop-blur-sm hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 hover:border-primary/60 hover:text-primary shadow-sm hover:shadow-glow hover:scale-110 active:scale-95 hover:-translate-y-1",
        secondary: "bg-gradient-to-r from-secondary to-secondary-dark text-secondary-foreground shadow-md hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:scale-110 active:scale-95 hover:-translate-y-1",
        ghost: "hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 hover:text-primary hover:scale-110 active:scale-95",
        link: "text-primary underline-offset-4 hover:underline hover:scale-110 active:scale-95 hover:text-accent",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
