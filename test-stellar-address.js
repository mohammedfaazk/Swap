const StellarSdk = require('@stellar/stellar-sdk');

const bridgeAddress = 'GCXE2JYQAZBGZZFUVQ6ENWCLKIQHQVWJBMDEDH6LXNLHK3VNNTCAODXW';

console.log('Testing Stellar bridge address:', bridgeAddress);
console.log('Length:', bridgeAddress.length);
console.log('Starts with G:', bridgeAddress.startsWith('G'));

try {
  const isValid = StellarSdk.StrKey.isValidEd25519PublicKey(bridgeAddress);
  console.log('Is valid Ed25519 public key:', isValid);
  
  if (isValid) {
    const decoded = StellarSdk.StrKey.decodeEd25519PublicKey(bridgeAddress);
    console.log('Decoded successfully, length:', decoded.length);
  } else {
    console.log('❌ Bridge address is INVALID!');
  }
} catch (error) {
  console.error('❌ Error validating bridge address:', error.message);
}