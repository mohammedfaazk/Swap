import { logger } from '../utils/logger';

export class PartialFillOptimizer {
  /**
   * Split large orders into partial fill chunks
   * @param amount total swap amount in base units
   * @param maxChunkSize maximum chunk size
   * @returns array of fill amounts
   */
  splitOrder(amount: bigint, maxChunkSize: bigint): bigint[] {
    if (amount <= maxChunkSize) return [amount];

    const chunks: bigint[] = [];
    let remaining = amount;

    while (remaining > 0n) {
      const chunk = remaining > maxChunkSize ? maxChunkSize : remaining;
      chunks.push(chunk);
      remaining -= chunk;
    }
    logger.debug(`Split ${amount} into chunks ${chunks}`);
    return chunks;
  }

  /**
   * Optimize fills to maximize resolver profit and minimize latency
   * For demo, simply returns chunks from splitOrder
   */
  optimizePartialFills(amount: bigint, maxChunkSize: bigint): bigint[] {
    return this.splitOrder(amount, maxChunkSize);
  }
}
