import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button 
      {...props} 
      className={cn(
        "bg-brand px-4 py-2 rounded text-white shadow font-semibold hover:opacity-90 transition",
        props.className
      )}
    >
      {props.children}
    </button>
  );
}