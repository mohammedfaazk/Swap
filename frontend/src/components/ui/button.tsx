export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={bg-brand px-4 py-2 rounded text-white shadow font-semibold hover:opacity-90 transition ${props.className ?? ""}}>
      {props.children}
    </button>
  );
}