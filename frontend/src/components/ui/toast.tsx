import { useEffect } from "react";
export function Toast({ show, message, duration = 3000, onClose }: { show: boolean, message: string, duration?: number, onClose: () => void }) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onClose, duration);
      return () => clearTimeout(t);
    }
  }, [show]);
  return show ? (<div className="fixed top-10 right-5 bg-brand text-white px-6 py-3 rounded shadow z-50">{message}</div>) : null;
}