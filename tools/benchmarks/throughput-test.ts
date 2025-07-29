import { CrossChainCoordinator } from '../../relayer/src/coordination/CrossChainCoordinator';
import { PrismaClient } from '@prisma/client';

async function runThroughputTest() {
  const prisma = new PrismaClient();
  const coordinator = new CrossChainCoordinator(null, null, prisma);

  const concurrency = 20;
  const totalRequests = 1000;

  let inFlight = 0;
  let completed = 0;

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function sendSwapRequest(index: number) {
    inFlight++;
    await coordinator.initiateSwap({
      fromChain: 'ethereum',
      toChain: 'stellar',
      fromToken: 'ETH',
      toToken: 'XLM',
      amount: '1000000000000000000',
      userAddress: `0xTestUser${index}`,
      destinationAddress: `GTest${index}`,
      timelock: 3600,
      partialFillsEnabled: false,
      slippage: 0.5,
    });
    completed++;
    inFlight--;
  }

  const startTime = Date.now();

  const promises: Promise<void>[] = [];
  for (let i = 0; i < totalRequests; i++) {
    while (inFlight >= concurrency) {
      await sleep(10);
    }
    promises.push(sendSwapRequest(i));
  }

  await Promise.all(promises);

  const elapsed = Date.now() - startTime;

  console.log(`Sent ${totalRequests} swaps with concurrency ${concurrency} in ${elapsed} ms`);
  console.log(`Average TPS: ${(totalRequests / (elapsed / 1000)).toFixed(2)}`);

  await prisma.$disconnect();
}

runThroughputTest().catch(console.error);
