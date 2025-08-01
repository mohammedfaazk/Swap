import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function Button({ variant = "default", size = "default", className, ...props }: ButtonProps) {
  const baseStyles = "font-semibold rounded transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    default: "bg-brand text-white shadow hover:opacity-90",
    outline: "border-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white",
    ghost: "text-slate-300 hover:bg-slate-700 hover:text-white"
  };

  const sizes = {
    default: "px-4 py-2",
    sm: "px-3 py-1.5 text-sm",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <button 
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