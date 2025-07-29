import { Server, Keypair, Networks, TransactionBuilder, BASE_FEE, Asset } from '@stellar/stellar-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

export class StellarService {
  server: Server;
  networkPassphrase: string;

  constructor() {
    this.server = new Server(config.stellar.horizonUrl);
    this.networkPassphrase = config.stellar.networkPassphrase;
  }

  async getAccount(publicKey: string) {
    return await this.server.loadAccount(publicKey);
  }

  async submitTransaction(tx) {
    return await this.server.submitTransaction(tx);
  }

  async buildAndSubmitSwap(
    source: Keypair,
    swapId: string,
    amount: string,
    stellarAccount: string,
    hashlock: string,
    timelock: number
  ) {
    const account = await this.getAccount(source.publicKey());

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      // Add operations for atomic swap to Stellar
      // Example: call the Stellar Soroban contract with params
      .setTimeout(30)
      .build();

    transaction.sign(source);

    try {
      const result = await this.submitTransaction(transaction);
      logger.info(`Stellar swap transaction successful with hash: ${result.hash}`);
      return result;
    } catch (error) {
      logger.error('Stellar swap failed:', error);
      throw error;
    }
  }
}
