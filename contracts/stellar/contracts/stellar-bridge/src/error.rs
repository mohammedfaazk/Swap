use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // General errors
    InvalidAmount = 1,
    InvalidTimelock = 2,
    InvalidSecretHash = 3,
    InvalidAddress = 4,
    
    // Swap state errors
    SwapNotFound = 10,
    SwapAlreadyExists = 11,
    SwapAlreadyCompleted = 12,
    SwapAlreadyRefunded = 13,
    SwapExpired = 14,
    InvalidSwapState = 15,
    
    // Secret and proof errors
    InvalidSecret = 20,
    SecretAlreadyUsed = 21,
    InvalidMerkleProof = 22,
    
    // Partial fill errors
    PartialFillsNotEnabled = 30,
    InvalidFillAmount = 31,
    ExceedsSwapAmount = 32,
    
    // Authorization errors
    Unauthorized = 40,
    UnauthorizedRefund = 41,
    NotActiveResolver = 42,
    
    // Timelock errors
    TimelockNotExpired = 50,
    TimelockTooShort = 51,
    TimelockTooLong = 52,
    
    // Resolver errors
    ResolverNotFound = 60,
    ResolverAlreadyRegistered = 61,
    InsufficientStake = 62,
    ResolverNotActive = 63,
    
    // Token errors
    InsufficientBalance = 70,
    TransferFailed = 71,
    TokenNotSupported = 72,
    
    // System errors
    ContractPaused = 80,
    SystemError = 81,
    StorageError = 82,
    CalculationOverflow = 83,
}

impl From<ContractError> for soroban_sdk::Error {
    fn from(err: ContractError) -> Self {
        soroban_sdk::Error::from_contract_error(err as u32)
    }
}

// Helper functions for error handling
impl ContractError {
    pub fn is_critical(&self) -> bool {
        matches!(
            self,
            ContractError::SystemError
                | ContractError::StorageError
                | ContractError::CalculationOverflow
        )
    }
    
    pub fn is_user_error(&self) -> bool {
        matches!(
            self,
            ContractError::InvalidAmount
                | ContractError::InvalidTimelock
                | ContractError::InvalidSecretHash
                | ContractError::InvalidAddress
                | ContractError::InvalidSecret
                | ContractError::InvalidFillAmount
        )
    }
    
    pub fn error_message(&self) -> &'static str {
        match self {
            ContractError::InvalidAmount => "Amount must be positive",
            ContractError::InvalidTimelock => "Timelock must be between min and max values",
            ContractError::InvalidSecretHash => "Secret hash cannot be empty",
            ContractError::InvalidAddress => "Invalid address provided",
            ContractError::SwapNotFound => "Swap does not exist",
            ContractError::SwapAlreadyExists => "Swap already exists",
            ContractError::SwapAlreadyCompleted => "Swap already completed",
            ContractError::SwapAlreadyRefunded => "Swap already refunded",
            ContractError::SwapExpired => "Swap has expired",
            ContractError::InvalidSwapState => "Invalid swap state for this operation",
            ContractError::InvalidSecret => "Invalid secret provided",
            ContractError::SecretAlreadyUsed => "Secret has already been used",
            ContractError::InvalidMerkleProof => "Invalid Merkle proof",
            ContractError::PartialFillsNotEnabled => "Partial fills not enabled for this swap",
            ContractError::InvalidFillAmount => "Fill amount must be positive",
            ContractError::ExceedsSwapAmount => "Fill amount exceeds remaining swap amount",
            ContractError::Unauthorized => "Unauthorized operation",
            ContractError::UnauthorizedRefund => "Only initiator can refund",
            ContractError::NotActiveResolver => "Not an active resolver",
            ContractError::TimelockNotExpired => "Timelock has not expired",
            ContractError::TimelockTooShort => "Timelock too short",
            ContractError::TimelockTooLong => "Timelock too long",
            ContractError::ResolverNotFound => "Resolver not found",
            ContractError::ResolverAlreadyRegistered => "Resolver already registered",
            ContractError::InsufficientStake => "Insufficient stake amount",
            ContractError::ResolverNotActive => "Resolver is not active",
            ContractError::InsufficientBalance => "Insufficient token balance",
            ContractError::TransferFailed => "Token transfer failed",
            ContractError::TokenNotSupported => "Token not supported",
            ContractError::ContractPaused => "Contract is paused",
            ContractError::SystemError => "System error occurred",
            ContractError::StorageError => "Storage error occurred",
            ContractError::CalculationOverflow => "Calculation overflow",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_classification() {
        assert!(ContractError::InvalidAmount.is_user_error());
        assert!(ContractError::SystemError.is_critical());
        assert!(!ContractError::SwapNotFound.is_critical());
        assert!(!ContractError::SystemError.is_user_error());
    }

    #[test]
    fn test_error_messages() {
        assert_eq!(
            ContractError::InvalidAmount.error_message(),
            "Amount must be positive"
        );
        assert_eq!(
            ContractError::SwapNotFound.error_message(),
            "Swap does not exist"
        );
    }
}
