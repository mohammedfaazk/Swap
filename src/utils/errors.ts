export class SwapNotFoundError extends Error {
  constructor(swapId: string) {
    super(`Swap not found: ${swapId}`);
    this.name = 'SwapNotFoundError';
  }
}

export class ResolverUnauthorizedError extends Error {
  constructor(resolver: string) {
    super(`Resolver unauthorized: ${resolver}`);
    this.name = 'ResolverUnauthorizedError';
  }
}

// Add other custom errors similarly ...
