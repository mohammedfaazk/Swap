import { StrKey } from "@stellar/stellar-sdk";
export function isValidStellarAddress(address: string) {
  return StrKey.isValidEd25519PublicKey(address);
}
