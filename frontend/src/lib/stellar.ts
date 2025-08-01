import { 
  Horizon,
  Networks, 
  TransactionBuilder, 
  Operation, 
  Asset, 
  StrKey, 
  Keypair, 
  Memo
} from "@stellar/stellar-sdk";

export const STELLAR_TESTNET_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_NETWORK = Networks.TESTNET;

export function isValidStellarAddress(address: string) {
  return StrKey.isValidEd25519PublicKey(address);
}

export function getStellarServer() {
  return new Horizon.Server(STELLAR_TESTNET_URL);
}

// For demo purposes - in production, use proper wallet integration like Freighter
let stellarKeypair: any | null = null;

export function connectStellarWallet() {
  // In a real app, you'd integrate with Freighter wallet or similar
  // For demo, we'll generate/use a test keypair
  if (!stellarKeypair) {
    // You can replace this with actual keypair for testing
    stellarKeypair = Keypair.random();
    console.log("Generated Stellar test wallet:", stellarKeypair.publicKey());
  }
  return stellarKeypair;
}

export async function initiateStellarSwap(
  sourceKeypair: any,
  destinationAddress: string,
  amount: string,
  memo: string
) {
  try {
    const server = getStellarServer();
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
    
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: "10000", // 0.001 XLM fee
      networkPassphrase: STELLAR_NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: destinationAddress,
          asset: Asset.native(), // XLM
          amount: amount,
        })
      )
      .addMemo(Memo.text(memo))
      .setTimeout(30)
      .build();
    
    transaction.sign(sourceKeypair);
    
    const result = await server.submitTransaction(transaction);
    console.log("Stellar transaction submitted:", result);
    
    return {
      success: true,
      txHash: result.hash,
      ledger: result.ledger
    };
  } catch (error) {
    console.error("Failed to initiate Stellar swap:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function getStellarBalance(publicKey: string): Promise<string> {
  try {
    const server = getStellarServer();
    const account = await server.loadAccount(publicKey);
    const nativeBalance = account.balances.find((balance: any) => balance.asset_type === 'native');
    return nativeBalance?.balance || "0";
  } catch (error) {
    console.error("Failed to get Stellar balance:", error);
    return "0";
  }
}

export async function fundTestAccount(publicKey: string) {
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    if (response.ok) {
      console.log("Test account funded successfully");
      return true;
    } else {
      console.error("Failed to fund test account");
      return false;
    }
  } catch (error) {
    console.error("Error funding test account:", error);
    return false;
  }
}
