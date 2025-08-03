"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className, asChild, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
    
    const variants = {
      default: "bg-brand text-white shadow hover:opacity-90 hover:shadow-lg",
      outline: "border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500",
      ghost: "text-slate-300 hover:bg-slate-700 hover:text-white"
    };

    const sizes = {
      default: "px-4 py-2 text-base",
      sm: "px-3 py-1.5 text-sm",
      lg: "px-6 py-3 text-lg"
    };

    if (asChild) {
      return (
        <span className={cn(baseStyles, variants[variant], sizes[size], className)}>
          {props.children}
        </span>
      );
    }

    return (
      <button 
        ref={ref}
        {...props} 
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
      >
        {props.children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };