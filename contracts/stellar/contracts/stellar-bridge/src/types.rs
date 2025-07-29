use soroban_sdk::{contracttype, Address, Bytes, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Swap {
    pub initiator: Address,
    pub token: Address,
    pub amount: i128,
    pub filled: i128,
    pub secret_hash: BytesN<32>,
    pub timelock: u64,
    pub ethereum_address: Bytes,
    pub state: SwapState,
    pub partial_fill_enabled: bool,
    pub merkle_root: BytesN<32>,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SwapState {
    Initiated = 0,
    PartialFilled = 1,
    Completed = 2,
    Refunded = 3,
    Expired = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Resolver {
    pub stake: i128,
    pub reputation: u32,
    pub total_volume: i128,
    pub success_rate: u32,
    pub active: bool,
    pub registration_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PartialFill {
    pub resolver: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub merkle_proof: soroban_sdk::Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Analytics {
    pub total_volume: i128,
    pub total_swaps: u32,
    pub total_resolvers: u32,
    pub success_rate: u32,
    pub average_completion_time: u64,
}
