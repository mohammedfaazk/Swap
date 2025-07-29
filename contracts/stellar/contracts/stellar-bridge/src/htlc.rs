use soroban_sdk::{Address, BytesN, Env};
use crate::types::{Swap, SwapState};
use crate::errors::ContractError;

pub fn validate_secret(env: &Env, secret: &BytesN<32>, secret_hash: &BytesN<32>) -> bool {
    let computed_hash = env.crypto().keccak256(secret);
    computed_hash == *secret_hash
}

pub fn is_timelock_expired(env: &Env, timelock: u64) -> bool {
    env.ledger().timestamp() >= timelock
}

pub fn can_complete_swap(env: &Env, swap: &Swap) -> Result<(), ContractError> {
    match swap.state {
        SwapState::Initiated | SwapState::PartialFilled => {
            if is_timelock_expired(env, swap.timelock) {
                Err(ContractError::SwapExpired)
            } else {
                Ok(())
            }
        }
        SwapState::Completed => Err(ContractError::SwapAlreadyCompleted),
        SwapState::Refunded => Err(ContractError::SwapAlreadyRefunded),
        SwapState::Expired => Err(ContractError::SwapExpired),
    }
}

pub fn can_refund_swap(env: &Env, swap: &Swap, caller: &Address) -> Result<(), ContractError> {
    // Only initiator can refund
    if *caller != swap.initiator {
        return Err(ContractError::UnauthorizedRefund);
    }

    // Can only refund initiated or partial filled swaps
    match swap.state {
        SwapState::Initiated | SwapState::PartialFilled => {
            if !is_timelock_expired(env, swap.timelock) {
                Err(ContractError::TimelockNotExpired)
            } else {
                Ok(())
            }
        }
        SwapState::Completed => Err(ContractError::SwapAlreadyCompleted),
        SwapState::Refunded => Err(ContractError::SwapAlreadyRefunded),
        SwapState::Expired => Err(ContractError::SwapExpired),
    }
}

pub fn calculate_fill_reward(fill_amount: i128, base_fee_rate: u32) -> i128 {
    // Calculate reward as percentage of fill amount
    // base_fee_rate is in basis points (10000 = 100%)
    (fill_amount * base_fee_rate as i128) / 10000
}

pub fn validate_partial_fill(
    env: &Env,
    swap: &Swap,
    fill_amount: i128,
    resolver: &Address,
) -> Result<(), ContractError> {
    // Check if partial fills are enabled
    if !swap.partial_fill_enabled {
        return Err(ContractError::PartialFillsNotEnabled);
    }

    // Check swap state
    match swap.state {
        SwapState::Initiated | SwapState::PartialFilled => {}
        _ => return Err(ContractError::InvalidSwapState),
    }

    // Check timelock
    if is_timelock_expired(env, swap.timelock) {
        return Err(ContractError::SwapExpired);
    }

    // Validate fill amount
    if fill_amount <= 0 {
        return Err(ContractError::InvalidFillAmount);
    }

    if swap.filled + fill_amount > swap.amount {
        return Err(ContractError::ExceedsSwapAmount);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, BytesN as _};
    use soroban_sdk::{Address, BytesN, Env};

    #[test]
    fn test_validate_secret() {
        let env = Env::default();
        let secret = BytesN::random(&env);
        let secret_hash = env.crypto().keccak256(&secret);
        
        assert!(validate_secret(&env, &secret, &secret_hash));
        
        let wrong_hash = BytesN::random(&env);
        assert!(!validate_secret(&env, &secret, &wrong_hash));
    }

    #[test]
    fn test_timelock_expired() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.timestamp = 1000);
        
        assert!(!is_timelock_expired(&env, 2000));
        assert!(is_timelock_expired(&env, 500));
        assert!(is_timelock_expired(&env, 1000));
    }

    #[test]
    fn test_calculate_fill_reward() {
        // 1% fee (100 basis points)
        assert_eq!(calculate_fill_reward(10000, 100), 100);
        
        // 0.1% fee (10 basis points)
        assert_eq!(calculate_fill_reward(10000, 10), 10);
        
        // 10% fee (1000 basis points)
        assert_eq!(calculate_fill_reward(10000, 1000), 1000);
    }
}
