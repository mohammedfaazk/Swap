import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';

export class EthereumService {
  provider: ethers.providers.JsonRpcProvider;
  signer?: ethers.Signer;
  contract?: ethers.Contract;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.ethereum.rpcUrl);
  }

  async connectWallet(privateKey: string) {
    this.signer = new ethers.Wallet(privateKey, this.provider);
  }

  async attachContract(address: string, abi: any) {
    if (!this.signer) throw new Error('Wallet not connected');
    this.contract = new ethers.Contract(address, abi, this.signer);
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
      { value: ethers.utils.parseEther(params.amount) }
    );

    const receipt = await tx.wait();
    logger.info(`Swap initiated, tx hash: ${receipt.transactionHash}`);
    return receipt;
  }

  // Additional methods: completeSwap, refundSwap, querySwaps
}
