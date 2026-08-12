import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'motion/react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  variant?: 'default' | 'glass' | 'neon-hover';
  animated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glass, variant = 'default', animated, children, ...props }, ref) => {
    const baseStyles = "rounded-2xl border bg-surface text-foreground shadow-sm overflow-hidden transition-all duration-300";
    
    let variantStyles = "border-border";
    if (glass || variant === 'glass') {
      variantStyles = "glass-panel bg-surface/60 border-white/5";
    } else if (variant === 'neon-hover') {
      variantStyles = "border-border hover:border-primary/50 hover:shadow-[0_0_20px_rgba(0,255,136,0.15)] hover:-translate-y-1";
    }
    
    const Component = animated ? motion.div : 'div';
    const animationProps = animated ? {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3 }
    } : {};

    return (
      <Component
        ref={ref as any}
        className={cn(baseStyles, variantStyles, className)}
        {...animationProps}
        {...props as any}
      >
        {children}
      </Component>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-foreground-muted", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0 md:p-6 md:pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";
