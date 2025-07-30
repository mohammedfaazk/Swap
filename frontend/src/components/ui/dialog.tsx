import { useState } from "react";
export function Dialog({ children, trigger, open, setOpen }: { children: React.ReactNode; trigger: React.ReactNode; open?: boolean; setOpen?: (o: boolean) => void; }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = setOpen ?? setInternalOpen;
  return (
    <>
      <span onClick={() => setIsOpen(true)}>{trigger}</span>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-slate-800 p-8 rounded shadow relative">
            <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2 text-lg">×</button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}