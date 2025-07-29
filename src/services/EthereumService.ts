import { ethers } from 'ethers';
import { config } from '../config';
import { logger } from '../utils/logger';

export class EthereumService {
  private provider: ethers.providers.JsonRpcProvider;
  private signer?: ethers.Signer;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.ethereum.rpcUrl);
    const privateKey = config.ethereum.privateKey;
    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }
    // Assume ABI and contract address are imported or available
    const abi = require('../../contracts/ethereum/artifacts/StellarBridgeFusionPlus.json').abi;
    this.contract = new ethers.Contract(config.ethereum.contractAddress, abi, this.signer || this.provider);
  }

  async initiateSwap(params: {
    hashlock: string;
    timelock: number;
    stellarAccount: string;
    resolver: string;
    enablePartialFill: boolean;
    minimumFill: string;
    amount: string;
  }): Promise<string> {
    if (!this.signer) throw new Error('No signer available');

    const tx = await this.contract.initiateSwap(
      params.hashlock,
      params.timelock,
      params.stellarAccount,
      params.resolver,
      params.enablePartialFill,
      ethers.utils.parseEther(params.minimumFill || '0'),
      { value: ethers.utils.parseEther(params.amount) }
    );

    const receipt = await tx.wait();

    // Extract swapId from event
    const event = receipt.events?.find((e: any) => e.event === 'SwapInitiated');
    return event?.args?.swapId;
  }

  // Other contract interaction methods...
}
