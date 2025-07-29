Qexport interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SwapInitiateRequest {
  initiator: string;
  amount: string;
  hashlock: string;
  timelock: number;
  stellarAccount: string;
  resolver: string;
  enablePartialFill?: boolean;
  minimumFill?: string;
}
