import { CrossChainCoordinator } from '../../relayer/src/coordination/CrossChainCoordinator';
import { PrismaClient } from '@prisma/client';

async function runSwapPerformanceBenchmark() {
  const prisma = new PrismaClient();
  const coordinator = new CrossChainCoordinator(null, null, prisma);

  const startTime = Date.now();

  // Run 100 swaps sequentially for benchmarking
  for (let i = 0; i < 100; i++) {
    await coordinator.initiateSwap({
      fromChain: 'ethereum',
      toChain: 'stellar',
      fromToken: 'ETH',
      toToken: 'XLM',
      amount: '1000000000000000000',
      userAddress: `0xBenchmarkUser${i}`,
      destinationAddress: `GBenchmark${i}`,
      timelock: 3600,
      partialFillsEnabled: false,
      slippage: 0.5,
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(`Completed 100 swaps in ${elapsed} ms`);

  await prisma.$disconnect();
}

runSwapPerformanceBenchmark().catch(console.error);
