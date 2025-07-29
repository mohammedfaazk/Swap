use soroban_sdk::{Address, BytesN, Env, Vec};
use crate::types::{PartialFill, Swap, SwapState};
use crate::errors::ContractError;
use crate::htlc::{validate_partial_fill, calculate_fill_reward};

pub fn verify_merkle_proof(
    env: &Env,
    proof: &Vec<BytesN<32>>,
    root: &BytesN<32>,
    leaf: &BytesN<32>,
) -> bool {
    let mut computed_hash = *leaf;
    
    for proof_element in proof.iter() {
        computed_hash = if computed_hash.to_array() < proof_element.to_array() {
            env.crypto().keccak256(&(computed_hash, proof_element))
        } else {
            env.crypto().keccak256(&(proof_element, computed_hash))
        };
    }
    
    computed_hash == *root
}

pub fn execute_partial_fill(
    env: &Env,
    swap: &mut Swap,
    resolver: &Address,
    fill_amount: i128,
    merkle_proof: Vec<BytesN<32>>,
    nonce: u64,
) -> Result<i128, ContractError> {
    // Validate the partial fill
    validate_partial_fill(env, swap, fill_amount, resolver)?;
    
    // Create leaf for merkle proof verification
    let leaf = env.crypto().keccak256(&(resolver.clone(), fill_amount, nonce));
    
    // Verify merkle proof for MEV protection
    if !verify_merkle_proof(env, &merkle_proof, &swap.merkle_root, &leaf) {
        return Err(ContractError::InvalidMerkleProof);
    }
    
    // Update swap state
    swap.filled += fill_amount;
    swap.state = if swap.filled == swap.amount {
        SwapState::Completed
    } else {
        SwapState::PartialFilled
    };
    
    // Calculate reward
    let reward = calculate_fill_reward(fill_amount, 10); // 0.1% fee
    
    // Record the partial fill
    let partial_fill = PartialFill {
        resolver: resolver.clone(),
        amount: fill_amount,
        timestamp: env.ledger().timestamp(),
        merkle_proof,
    };
    
    // Store partial fill data (in real implementation)
    // env.storage().persistent().set(&(PARTIAL_FILL_KEY, swap_id, resolver), &partial_fill);
    
    Ok(reward)
}

pub fn get_partial_fills(
    env: &Env,
    swap_id: &BytesN<32>,
) -> Vec<PartialFill> {
    // In real implementation, retrieve all partial fills for a swap
    // For now, return empty vector
    Vec::new(env)
}

pub fn calculate_optimal_fill_sizes(
    total_amount: i128,
    num_resolvers: u32,
    min_fill_size: i128,
) -> Vec<i128> {
    let mut fill_sizes = Vec::new();
    
    if num_resolvers == 0 {
        return fill_sizes;
    }
    
    // Calculate base fill size
    let base_fill = total_amount / num_resolvers as i128;
    let remainder = total_amount % num_resolvers as i128;
    
    // Distribute amounts ensuring minimum fill size
    let mut remaining = total_amount;
    for i in 0..num_resolvers {
        let fill_size = if base_fill >= min_fill_size {
            let extra = if (i as i128) < remainder { 1 } else { 0 };
            base_fill + extra
        } else if remaining >= min_fill_size {
            min_fill_size.min(remaining)
        } else {
            remaining
        };
        
        if fill_size > 0 {
            fill_sizes.push(fill_size);
            remaining -= fill_size;
        }
        
        if remaining <= 0 {
            break;
        }
    }
    
    fill_sizes
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, BytesN as _};
    use soroban_sdk::{vec, Env};

    #[test]
    fn test_verify_merkle_proof_single() {
        let env = Env::default();
        let leaf = BytesN::random(&env);
        let proof = vec![&env];
        
        // Single leaf tree - root equals leaf
        assert!(verify_merkle_proof(&env, &proof, &leaf, &leaf));
    }

    #[test]
    fn test_verify_merkle_proof_pair() {
        let env = Env::default();
        let leaf1 = BytesN::random(&env);
        let leaf2 = BytesN::random(&env);
        
        // Calculate root for two-leaf tree
        let root = if leaf1.to_array() < leaf2.to_array() {
            env.crypto().keccak256(&(leaf1, leaf2))
        } else {
            env.crypto().keccak256(&(leaf2, leaf1))
        };
        
        let proof = vec![&env, leaf2];
        assert!(verify_merkle_proof(&env, &proof, &root, &leaf1));
    }

    #[test]
    fn test_calculate_optimal_fill_sizes() {
        // Test even distribution
        let fills = calculate_optimal_fill_sizes(1000, 4, 100);
        assert_eq!(fills.len(), 4);
        assert_eq!(fills.iter().sum::<i128>(), 1000);
        
        // Test with remainder
        let fills = calculate_optimal_fill_sizes(1001, 4, 100);
        assert_eq!(fills.len(), 4);
        assert_eq!(fills.iter().sum::<i128>(), 1001);
        
        // Test minimum fill size constraint
        let fills = calculate_optimal_fill_sizes(50, 4, 100);
        assert_eq!(fills.len(), 1);
        assert_eq!(fills[0], 50);
    }

    #[test]
    fn test_edge_cases() {
        // Zero amount
        let fills = calculate_optimal_fill_sizes(0, 4, 100);
        assert_eq!(fills.len(), 0);
        
        // Zero resolvers
        let fills = calculate_optimal_fill_sizes(1000, 0, 100);
        assert_eq!(fills.len(), 0);
        
        // Single resolver
        let fills = calculate_optimal_fill_sizes(1000, 1, 100);
        assert_eq!(fills.len(), 1);
        assert_eq!(fills[0], 1000);
    }
}
