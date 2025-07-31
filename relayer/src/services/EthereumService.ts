import { JsonRpcProvider, parseEther, Contract, Wallet } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';

export class EthereumService {
  provider: JsonRpcProvider;
  signer?: Wallet;
  contract?: Contract;

  constructor() {
    this.provider = new JsonRpcProvider(config.ethereum.rpcUrl);
  }

  async connectWallet(privateKey: string) {
    this.signer = new Wallet(privateKey, this.provider);
  }

  async attachContract(address: string, abi: any) {
    if (!this.signer) throw new Error('Wallet not connected');
    this.contract = new Contract(address, abi, this.signer);
  }

  async initiateSwap(params: {
    contractAddress: string;
    hashlock: string;
    timelock: number;
    stellarAccount: string;
    resolver: string;
    enablePartialFill: boolean;
    minimumFill: string;
    amount: string;
  }) {
    if (!this.contract) throw new Error('Contract not initialized');

    const tx = await this.contract.initiateSwap(
      params.hashlock,
      params.timelock,
      params.stellarAccount,
      params.resolver,
      params.enablePartialFill,
      params.minimumFill,
      { value: parseEther(params.amount) }
    );

    const receipt = await tx.wait();
    logger.info(`Swap initiated, tx hash: ${receipt.transactionHash}`);
    return receipt;
  }

  // Additional methods: completeSwap, refundSwap, querySwaps
}
