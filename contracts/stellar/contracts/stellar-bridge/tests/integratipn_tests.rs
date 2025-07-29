use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, BytesN, Bytes,
};
use stellar_bridge::{
    StellarBridgeContract, StellarBridgeContractClient,
    types::{Swap, SwapState, Resolver, Analytics},
};

#[cfg(test)]
mod integration_tests {
    use super::*;

    fn create_contract(e: &Env) -> StellarBridgeContractClient {
        let contract_address = e.register_contract(None, StellarBridgeContract);
        StellarBridgeContractClient::new(e, &contract_address)
    }

    #[test]
    fn test_complete_swap_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let initiator = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        
        // Initialize contract
        contract.initialize(&admin);
        
        // Setup test parameters
        let amount = 1_500_000_000i128; // 15,000 XLM in stroops
        let secret = BytesN::from_array(&env, &[1; 32]);
        let secret_hash = env.crypto().keccak256(&secret);
        let timelock = env.ledger().timestamp() + 3600;
        let ethereum_address = Bytes::from_slice(&env, &[0u8; 20]);
        let merkle_root = BytesN::from_array(&env, &[2; 32]);
        
        // Mint tokens to initiator
        env.as_contract(&token, || {
            env.invoke_contract(
                &token,
                &"mint",
                (initiator.clone(), amount).into_val(&env)
            )
        });
        
        // Initiate swap
        let swap_id = contract.initiate_swap(
            &initiator,
            &token,
            &amount,
            &secret_hash,
            &timelock,
            &ethereum_address,
            &true, // partial fills enabled
            &merkle_root
        );
        
        // Verify swap creation
        let swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(swap.initiator, initiator);
        assert_eq!(swap.amount, amount);
        assert_eq!(swap.state, SwapState::Initiated);
        
        // Complete swap
        contract.complete_swap(&swap_id, &secret);
        
        // Verify completion
        let completed_swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(completed_swap.state, SwapState::Completed);
    }
    
    #[test]
    fn test_partial_fills_with_multiple_resolvers() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let initiator = Address::generate(&env);
        let resolver1 = Address::generate(&env);
        let resolver2 = Address::generate(&env);
        let resolver3 = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        // Register resolvers
        let stake_amount = 2_000_000_000i128;
        contract.register_resolver(&resolver1, &stake_amount);
        contract.register_resolver(&resolver2, &stake_amount);
        contract.register_resolver(&resolver3, &stake_amount);
        
        // Setup large swap for partial fills
        let total_amount = 10_000_000_000i128; // 100,000 XLM
        let secret_hash = BytesN::from_array(&env, &[3; 32]);
        let timelock = env.ledger().timestamp() + 7200;
        let ethereum_address = Bytes::from_slice(&env, &[1u8; 20]);
        let merkle_root = BytesN::from_array(&env, &[4; 32]);
        
        // Mint tokens
        env.as_contract(&token, || {
            env.invoke_contract(
                &token,
                &"mint",
                (initiator.clone(), total_amount).into_val(&env)
            )
        });
        
        // Initiate swap
        let swap_id = contract.initiate_swap(
            &initiator,
            &token,
            &total_amount,
            &secret_hash,
            &timelock,
            &ethereum_address,
            &true,
            &merkle_root
        );
        
        // Execute partial fills
        let fill_amounts = [
            3_333_333_333i128, // ~33.33%
            3_333_333_333i128, // ~33.33% 
            3_333_333_334i128, // ~33.34% (remainder)
        ];
        
        let resolvers = [&resolver1, &resolver2, &resolver3];
        let merkle_proofs = [
            vec![&env, BytesN::from_array(&env, &[5; 32])],
            vec![&env, BytesN::from_array(&env, &[6; 32])],
            vec![&env, BytesN::from_array(&env, &[7; 32])],
        ];
        
        for (i, (&resolver_addr, &fill_amount)) in resolvers.iter().zip(fill_amounts.iter()).enumerate() {
            contract.execute_partial_fill(
                &swap_id,
                resolver_addr,
                &fill_amount,
                &merkle_proofs[i],
                &((i + 1) as u64)
            );
            
            // Verify partial fill
            let swap = contract.get_swap(&swap_id).unwrap();
            let expected_filled = fill_amounts[0..=i].iter().sum::<i128>();
            assert_eq!(swap.filled, expected_filled);
        }
        
        // Verify final state
        let final_swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(final_swap.state, SwapState::Completed);
        assert_eq!(final_swap.filled, total_amount);
        
        // Verify resolver performance updates
        for resolver_addr in resolvers.iter() {
            let resolver = contract.get_resolver(resolver_addr).unwrap();
            assert!(resolver.total_volume > 0);
        }
    }
    
    #[test]
    fn test_swap_refund_after_timeout() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let initiator = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        let amount = 5_000_000_000i128;
        let secret_hash = BytesN::from_array(&env, &[8; 32]);
        let short_timelock = env.ledger().timestamp() + 60; // 1 minute
        let ethereum_address = Bytes::from_slice(&env, &[2u8; 20]);
        let merkle_root = BytesN::from_array(&env, &[9; 32]);
        
        // Mint and initiate swap
        env.as_contract(&token, || {
            env.invoke_contract(
                &token,
                &"mint",
                (initiator.clone(), amount).into_val(&env)
            )
        });
        
        let swap_id = contract.initiate_swap(
            &initiator,
            &token,
            &amount,
            &secret_hash,
            &short_timelock,
            &ethereum_address,
            &false,
            &merkle_root
        );
        
        // Advance time past timelock
        env.ledger().with_mut(|li| {
            li.timestamp = short_timelock + 1;
        });
        
        // Refund should now be possible
        contract.refund_swap(&swap_id);
        
        // Verify refund
        let refunded_swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(refunded_swap.state, SwapState::Refunded);
        
        // Verify tokens returned to initiator
        let initiator_balance: i128 = env.as_contract(&token, || {
            env.invoke_contract(
                &token,
                &"balance",
                (initiator.clone(),).into_val(&env)
            )
        });
        assert_eq!(initiator_balance, amount);
    }
    
    #[test]
    fn test_resolver_registration_and_performance() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let resolver = Address::generate(&env);
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        let stake = 3_000_000_000i128; // 30 XLM
        
        // Register resolver
        contract.register_resolver(&resolver, &stake);
        
        // Verify registration
        let resolver_info = contract.get_resolver(&resolver).unwrap();
        assert_eq!(resolver_info.stake, stake);
        assert_eq!(resolver_info.reputation, 1000);
        assert_eq!(resolver_info.total_volume, 0);
        assert_eq!(resolver_info.success_rate, 10000);
        assert_eq!(resolver_info.active, true);
        
        // Verify analytics updated
        let analytics = contract.get_analytics();
        assert_eq!(analytics.total_resolvers, 1);
    }
    
    #[test]
    fn test_invalid_secret_rejection() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let initiator = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        let amount = 1_000_000_000i128;
        let correct_secret = BytesN::from_array(&env, &[10; 32]);
        let correct_secret_hash = env.crypto().keccak256(&correct_secret);
        let wrong_secret = BytesN::from_array(&env, &[11; 32]);
        let timelock = env.ledger().timestamp() + 3600;
        let ethereum_address = Bytes::from_slice(&env, &[3u8; 20]);
        let merkle_root = BytesN::from_array(&env, &[12; 32]);
        
        // Mint and initiate swap
        env.as_contract(&token, || {
            env.invoke_contract(
                &token,
                &"mint",
                (initiator.clone(), amount).into_val(&env)
            )
        });
        
        let swap_id = contract.initiate_swap(
            &initiator,
            &token,
            &amount,
            &correct_secret_hash,
            &timelock,
            &ethereum_address,
            &false,
            &merkle_root
        );
        
        // Try to complete with wrong secret - should panic
        let result = std::panic::catch_unwind(|| {
            contract.complete_swap(&swap_id, &wrong_secret);
        });
        assert!(result.is_err());
        
        // Verify swap state unchanged
        let swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(swap.state, SwapState::Initiated);
        
        // Complete with correct secret should work
        contract.complete_swap(&swap_id, &correct_secret);
        let completed_swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(completed_swap.state, SwapState::Completed);
    }
    
    #[test]
    fn test_merkle_proof_validation() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let initiator = Address::generate(&env);
        let resolver = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        // Register resolver
        contract.register_resolver(&resolver, &2_000_000_000i128);
        
        let amount = 6_000_000_000i128;
        let secret_hash = BytesN::from_array(&env, &[13; 32]);
        let timelock = env.ledger().timestamp() + 3600;
        let ethereum_address = Bytes::from_slice(&env, &[4u8; 20]);
        let valid_merkle_root = BytesN::from_array(&env, &[14; 32]);
        
        // Mint and initiate swap
        env.as_contract(&token, || {
            env.invoke_contract(
                &token,
                &"mint",
                (initiator.clone(), amount).into_val(&env)
            )
        });
        
        let swap_id = contract.initiate_swap(
            &initiator,
            &token,
            &amount,
            &secret_hash,
            &timelock,
            &ethereum_address,
            &true,
            &valid_merkle_root
        );
        
        // Valid merkle proof
        let valid_proof = vec![&env, BytesN::from_array(&env, &[15; 32])];
        let fill_amount = 2_000_000_000i128;
        
        // This should work (assuming merkle validation passes)
        contract.execute_partial_fill(
            &swap_id,
            &resolver,
            &fill_amount,
            &valid_proof,
            &1u64
        );
        
        // Verify partial fill executed
        let swap = contract.get_swap(&swap_id).unwrap();
        assert_eq!(swap.filled, fill_amount);
        assert_eq!(swap.state, SwapState::PartialFilled);
    }
    
    #[test]
    fn test_analytics_tracking() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let initiator = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        // Check initial analytics
        let initial_analytics = contract.get_analytics();
        assert_eq!(initial_analytics.total_swaps, 0);
        assert_eq!(initial_analytics.total_volume, 0);
        
        // Execute multiple swaps
        for i in 0..3 {
            let amount = (i + 1) as i128 * 1_000_000_000i128;
            let secret = BytesN::from_array(&env, &[(i + 20) as u8; 32]);
            let secret_hash = env.crypto().keccak256(&secret);
            let timelock = env.ledger().timestamp() + 3600;
            let ethereum_address = Bytes::from_slice(&env, &[(i + 5) as u8; 20]);
            let merkle_root = BytesN::from_array(&env, &[(i + 25) as u8; 32]);
            
            // Mint tokens
            env.as_contract(&token, || {
                env.invoke_contract(
                    &token,
                    &"mint",
                    (initiator.clone(), amount).into_val(&env)
                )
            });
            
            // Initiate and complete swap
            let swap_id = contract.initiate_swap(
                &initiator,
                &token,
                &amount,
                &secret_hash,
                &timelock,
                &ethereum_address,
                &false,
                &merkle_root
            );
            
            contract.complete_swap(&swap_id, &secret);
        }
        
        // Check updated analytics
        let final_analytics = contract.get_analytics();
        assert_eq!(final_analytics.total_swaps, 3);
        assert_eq!(final_analytics.total_volume, 6_000_000_000i128); // 1+2+3 billion
        assert_eq!(final_analytics.success_rate, 10000); // 100%
    }
    
    #[test]
    fn test_contract_pause_functionality() {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        
        let contract = create_contract(&env);
        contract.initialize(&admin);
        
        // Contract should not be paused initially
        assert!(!contract.is_paused());
        
        // Admin can pause
        contract.pause();
        assert!(contract.is_paused());
        
        // Operations should fail when paused
        let amount = 1_000_000_000i128;
        let secret_hash = BytesN::from_array(&env, &[30; 32]);
        let timelock = env.ledger().timestamp() + 3600;
        let ethereum_address = Bytes::from_slice(&env, &[10u8; 20]);
        let merkle_root = BytesN::from_array(&env, &[31; 32]);
        
        let result = std::panic::catch_unwind(|| {
            contract.initiate_swap(
                &user,
                &token,
                &amount,
                &secret_hash,
                &timelock,
                &ethereum_address,
                &false,
                &merkle_root
            );
        });
        assert!(result.is_err());
    }
}
