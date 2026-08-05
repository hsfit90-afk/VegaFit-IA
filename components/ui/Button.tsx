import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils'; // Assuming tailwind-merge exists. Need to check or create.

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', fullWidth, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-md",
      secondary: "bg-secondary text-white hover:bg-secondary-hover shadow-md",
      outline: "border border-border bg-transparent hover:bg-surface-light text-foreground",
      ghost: "hover:bg-surface-light hover:text-foreground text-foreground-muted",
      danger: "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20",
    };
    
    const sizes = {
      default: "h-12 px-6 py-2",
      sm: "h-9 rounded-md px-3 text-xs",
      lg: "h-14 rounded-2xl px-8 text-base",
      icon: "h-12 w-12",
    };

    const widthClass = fullWidth ? "w-full" : "";

    const combinedClassName = cn(baseStyles, variants[variant], sizes[size], widthClass, className);

    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        className={combinedClassName}
        ref={ref}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
