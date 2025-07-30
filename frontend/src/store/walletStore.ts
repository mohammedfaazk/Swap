import create from "zustand";
interface State {
  connected: boolean;
  address?: string;
  setConnected: (v: boolean) => void;
  setAddress: (a: string) => void;
}
export const useWalletStore = create<State>(set => ({
  connected: false,
  address: undefined,
  setConnected: v => set(() => ({ connected: v })),
  setAddress: a => set(() => ({ address: a }))
}));
