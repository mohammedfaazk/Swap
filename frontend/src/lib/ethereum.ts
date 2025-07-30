import { ethers } from "ethers";
export function getEthereumProvider() {
  // Browser only
  return typeof window !== "undefined" ? (window as any).ethereum : null;
}
