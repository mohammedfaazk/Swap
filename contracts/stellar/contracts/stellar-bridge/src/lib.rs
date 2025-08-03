#![no_std]

mod error;
mod htlc;
mod partial_fills;
mod types;

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype, token, Address, Bytes, BytesN, Env, Map,
    Symbol, Vec,
};

use crate::error::ContractError;
use crate::htlc::{can_complete_swap, can_refund_swap, validate_secret};
use crate::types::{Analytics, PartialFill, Resolver, Swap, SwapState};

// Contract metadata
contractmeta!(
    key = "Description",
    val = "Stellar Bridge HTLC - Cross-chain atomic swaps with partial fills"
);
contractmeta!(key = "Version", val = "1.0.0");
contractmeta!(key = "Author", val = "StellarBridge Team");

// Storage keys
#[contracttype]
pub enum StorageKey {
    Swap(BytesN<32>),
    Resolver(Address),
    UsedSecret(BytesN<32>),
    Analytics,
    Config,
    TotalSwaps,
    Paused,
}

// Configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub min_timelock: u64,
    pub max_timelock: u64,
    pub min_stake: i128,
    pub base_fee_rate: u32,
    pub resolver_reward_rate: u32,
    pub native_token: Address,
}

#[contract]
pub struct StellarBridge;

#[contractimpl]
impl StellarBridge {
    // Initialize the contract
    pub fn initialize(
        env: Env,
        admin: Address,
        min_timelock: u64,
        max_timelock: u64,
        min_stake: i128,
        base_fee_rate: u32,
        resolver_reward_rate: u32,
        native_token: Address,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&StorageKey::Config) {
            return Err(ContractError::SwapAlreadyExists);
        }

        let config = Config {
            admin,
            min_timelock,
            max_timelock,
            min_stake,
            base_fee_rate,
            resolver_reward_rate,
            native_token,
        };

        env.storage().instance().set(&StorageKey::Config, &config);
        env.storage().instance().set(&StorageKey::TotalSwaps, &0u32);
        env.storage().instance().set(&StorageKey::Paused, &false);

        // Initialize analytics
        let analytics = Analytics {
            total_volume: 0,
            total_swaps: 0,
            total_resolvers: 0,
            success_rate: 10000, // 100% in basis points
            average_completion_time: 0,
        };
        env.storage().instance().set(&StorageKey::Analytics, &analytics);

        env.events().publish(
            (Symbol::new(&env, "contract_initialized"),),
            (admin, min_timelock, max_timelock),
        );

        Ok(())
    }

    // Create a new atomic swap
    pub fn initiate_swap(
        env: Env,
        token: Address,
        amount: i128,
        secret_hash: BytesN<32>,
        timelock: u64,
        ethereum_address: Bytes,
        partial_fill_enabled: bool,
        merkle_root: BytesN<32>,
    ) -> Result<BytesN<32>, ContractError> {
        Self::require_not_paused(&env)?;
        
        let config: Config = env.storage().instance().get(&StorageKey::Config).unwrap();
        let initiator = env.current_contract_address();

        // Validate inputs
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }
        if secret_hash == BytesN::from_array(&env, &[0u8; 32]) {
            return Err(ContractError::InvalidSecretHash);
        }
        if timelock < config.min_timelock || timelock > config.max_timelock {
            return Err(ContractError::InvalidTimelock);
        }

        // Generate swap ID
        let swap_id = env.crypto().keccak256(&(
            &initiator,
            &token,
            &amount,
            &secret_hash,
            &timelock,
            &env.ledger().timestamp(),
        ));

        // Check if swap already exists
        if env.storage().persistent().has(&StorageKey::Swap(swap_id.clone())) {
            return Err(ContractError::SwapAlreadyExists);
        }

        // Transfer tokens to contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&initiator, &env.current_contract_address(), &amount);

        // Create swap
        let swap = Swap {
            initiator: initiator.clone(),
            token,
            amount,
            filled: 0,
            secret_hash,
            timelock: env.ledger().timestamp() + timelock,
            ethereum_address,
            state: SwapState::Initiated,
            partial_fill_enabled,
            merkle_root,
            created_at: env.ledger().timestamp(),
        };

        // Store swap
        env.storage().persistent().set(&StorageKey::Swap(swap_id.clone()), &swap);

        // Update analytics
        let mut analytics: Analytics = env.storage().instance().get(&StorageKey::Analytics).unwrap();
        analytics.total_swaps += 1;
        analytics.total_volume += amount;
        env.storage().instance().set(&StorageKey::Analytics, &analytics);

        let total_swaps: u32 = env.storage().instance().get(&StorageKey::TotalSwaps).unwrap();
        env.storage().instance().set(&StorageKey::TotalSwaps, &(total_swaps + 1));

        env.events().publish(
            (Symbol::new(&env, "swap_initiated"),),
            (swap_id.clone(), initiator, token, amount, timelock),
        );

        Ok(swap_id)
    }

    // Complete swap by revealing secret
    pub fn complete_swap(
        env: Env,
        swap_id: BytesN<32>,
        secret: BytesN<32>,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        
        let mut swap: Swap = env
            .storage()
            .persistent()
            .get(&StorageKey::Swap(swap_id.clone()))
            .ok_or(ContractError::SwapNotFound)?;

        // Validate swap can be completed
        can_complete_swap(&env, &swap)?;

        // Validate secret
        if !validate_secret(&env, &secret, &swap.secret_hash) {
            return Err(ContractError::InvalidSecret);
        }

        // Check if secret already used
        if env.storage().persistent().has(&StorageKey::UsedSecret(secret.clone())) {
            return Err(ContractError::SecretAlreadyUsed);
        }

        // Mark secret as used
        env.storage().persistent().set(&StorageKey::UsedSecret(secret.clone()), &true);

        // Complete the swap
        swap.state = SwapState::Completed;
        env.storage().persistent().set(&StorageKey::Swap(swap_id.clone()), &swap);

        // Transfer remaining tokens to resolver
        let remaining_amount = swap.amount - swap.filled;
        if remaining_amount > 0 {
            let token_client = token::Client::new(&env, &swap.token);
            token_client.transfer(
                &env.current_contract_address(),
                &env.invoker(),
                &remaining_amount,
            );
        }

        env.events().publish(
            (Symbol::new(&env, "swap_completed"),),
            (swap_id, secret, remaining_amount),
        );

        Ok(())
    }

    // Refund expired swap
    pub fn refund_swap(env: Env, swap_id: BytesN<32>) -> Result<(), ContractError> {
        let mut swap: Swap = env
            .storage()
            .persistent()
            .get(&StorageKey::Swap(swap_id.clone()))
            .ok_or(ContractError::SwapNotFound)?;

        let caller = env.invoker();
        can_refund_swap(&env, &swap, &caller)?;

        // Update swap state
        swap.state = SwapState::Refunded;
        env.storage().persistent().set(&StorageKey::Swap(swap_id.clone()), &swap);

        // Refund remaining tokens
        let refund_amount = swap.amount - swap.filled;
        if refund_amount > 0 {
            let token_client = token::Client::new(&env, &swap.token);
            token_client.transfer(
                &env.current_contract_address(),
                &swap.initiator,
                &refund_amount,
            );
        }

        env.events().publish(
            (Symbol::new(&env, "swap_refunded"),),
            (swap_id, swap.initiator.clone(), refund_amount),
        );

        Ok(())
    }

    // Execute partial fill
    pub fn execute_partial_fill(
        env: Env,
        swap_id: BytesN<32>,
        fill_amount: i128,
        merkle_proof: Vec<BytesN<32>>,
    ) -> Result<(), ContractError> {
        Self::require_not_paused(&env)?;
        Self::require_active_resolver(&env)?;

        let mut swap: Swap = env
            .storage()
            .persistent()
            .get(&StorageKey::Swap(swap_id.clone()))
            .ok_or(ContractError::SwapNotFound)?;

        let resolver = env.invoker();

        // Validate partial fill
        htlc::validate_partial_fill(&env, &swap, fill_amount, &resolver)?;

        // Verify merkle proof (simplified for demo)
        // In production, implement proper merkle proof verification

        // Update swap
        swap.filled += fill_amount;
        if swap.filled == swap.amount {
            swap.state = SwapState::Completed;
        } else {
            swap.state = SwapState::PartialFilled;
        }
        env.storage().persistent().set(&StorageKey::Swap(swap_id.clone()), &swap);

        // Calculate and transfer rewards
        let config: Config = env.storage().instance().get(&StorageKey::Config).unwrap();
        let reward = htlc::calculate_fill_reward(fill_amount, config.resolver_reward_rate);
        
        if reward > 0 {
            let token_client = token::Client::new(&env, &swap.token);
            token_client.transfer(&env.current_contract_address(), &resolver, &reward);
        }

        // Update resolver stats
        let mut resolver_data: Resolver = env
            .storage()
            .persistent()
            .get(&StorageKey::Resolver(resolver.clone()))
            .unwrap_or(Resolver {
                stake: 0,
                reputation: 1000,
                total_volume: 0,
                success_rate: 10000,
                active: false,
                registration_time: env.ledger().timestamp(),
            });

        resolver_data.total_volume += fill_amount;
        env.storage().persistent().set(&StorageKey::Resolver(resolver.clone()), &resolver_data);

        env.events().publish(
            (Symbol::new(&env, "partial_fill_executed"),),
            (swap_id, resolver, fill_amount, swap.filled),
        );

        Ok(())
    }

    // Register as resolver
    pub fn register_resolver(env: Env, stake_amount: i128) -> Result<(), ContractError> {
        let config: Config = env.storage().instance().get(&StorageKey::Config).unwrap();
        let resolver = env.invoker();

        if stake_amount < config.min_stake {
            return Err(ContractError::InsufficientStake);
        }

        if env.storage().persistent().has(&StorageKey::Resolver(resolver.clone())) {
            return Err(ContractError::ResolverAlreadyRegistered);
        }

        // Transfer stake
        let token_client = token::Client::new(&env, &config.native_token);
        token_client.transfer(&resolver, &env.current_contract_address(), &stake_amount);

        // Register resolver
        let resolver_data = Resolver {
            stake: stake_amount,
            reputation: 1000, // Starting reputation
            total_volume: 0,
            success_rate: 10000, // 100% starting rate
            active: true,
            registration_time: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&StorageKey::Resolver(resolver.clone()), &resolver_data);

        env.events().publish(
            (Symbol::new(&env, "resolver_registered"),),
            (resolver, stake_amount),
        );

        Ok(())
    }

    // View functions
    pub fn get_swap(env: Env, swap_id: BytesN<32>) -> Result<Swap, ContractError> {
        env.storage()
            .persistent()
            .get(&StorageKey::Swap(swap_id))
            .ok_or(ContractError::SwapNotFound)
    }

    pub fn get_resolver(env: Env, resolver: Address) -> Result<Resolver, ContractError> {
        env.storage()
            .persistent()
            .get(&StorageKey::Resolver(resolver))
            .ok_or(ContractError::ResolverNotFound)
    }

    pub fn get_analytics(env: Env) -> Analytics {
        env.storage()
            .instance()
            .get(&StorageKey::Analytics)
            .unwrap_or(Analytics {
                total_volume: 0,
                total_swaps: 0,
                total_resolvers: 0,
                success_rate: 10000,
                average_completion_time: 0,
            })
    }

    pub fn is_secret_used(env: Env, secret: BytesN<32>) -> bool {
        env.storage().persistent().has(&StorageKey::UsedSecret(secret))
    }

    // Admin functions
    pub fn pause(env: Env) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&StorageKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), ContractError> {
        Self::require_admin(&env)?;
        env.storage().instance().set(&StorageKey::Paused, &false);
        Ok(())
    }

    // Internal helper functions
    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let config: Config = env.storage().instance().get(&StorageKey::Config).unwrap();
        if env.invoker() != config.admin {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        let paused: bool = env.storage().instance().get(&StorageKey::Paused).unwrap_or(false);
        if paused {
            return Err(ContractError::ContractPaused);
        }
        Ok(())
    }

    fn require_active_resolver(env: &Env) -> Result<(), ContractError> {
        let resolver = env.invoker();
        let resolver_data: Resolver = env
            .storage()
            .persistent()
            .get(&StorageKey::Resolver(resolver))
            .ok_or(ContractError::ResolverNotFound)?;

        if !resolver_data.active {
            return Err(ContractError::ResolverNotActive);
        }

        Ok(())
    }
}
