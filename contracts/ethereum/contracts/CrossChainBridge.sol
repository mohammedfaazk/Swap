// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./ProductionHTLC.sol";

/**
 * @title CrossChainBridge
 * @dev Production-ready cross-chain bridge with secure escrow
 * @author StellarBridge Team
 * 
 * Features:
 * - Secure escrow for ETH and ERC20 tokens
 * - Multi-signature validation for cross-chain operations
 * - Merkle tree verification for transaction batching
 * - Circuit breakers and emergency controls
 * - Comprehensive monitoring and analytics
 * - Support for multiple bridge operators
 */
contract CrossChainBridge is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    
    struct CrossChainSwap {
        address initiator;
        address token;
        uint256 amount;
        string destinationChain;
        string destinationAddress;
        bytes32 secretHash;
        uint256 timelock;
        uint256 createdAt;
        SwapState state;
        bytes32 merkleRoot;
        uint256 requiredSignatures;
        mapping(address => bool) operatorSignatures;
        uint256 signatureCount;
        bytes32 stellarTxHash;
        uint256 networkFee;
    }
    
    struct BridgeOperator {
        bool active;
        uint256 stake;
        uint256 reputation;
        uint256 totalOperations;
        uint256 successfulOperations;
        address rewardAddress;
    }
    
    struct ChainConfig {
        bool supported;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 confirmationBlocks;
        uint256 networkFee;
        string rpcEndpoint;
    }
    
    enum SwapState {
        INITIATED,
        VALIDATED,
        EXECUTED,
        COMPLETED,
        REFUNDED,
        FAILED
    }
    
    // State variables
    mapping(bytes32 => CrossChainSwap) public swaps;
    mapping(address => BridgeOperator) public operators;
    mapping(string => ChainConfig) public supportedChains;
    mapping(bytes32 => bool) public processedTxHashes;
    mapping(address => uint256) public userNonces;
    
    address[] public operatorList;
    uint256 public requiredOperators = 3;
    uint256 public operatorStakeAmount = 10 ether;
    
    // ETH/Token reserves
    uint256 public ethReserve;
    mapping(address => uint256) public tokenReserves;
    
    // Fee structure
    uint256 public bridgeFee = 30; // 0.3% in basis points
    uint256 public operatorReward = 10; // 0.1% in basis points
    address public feeRecipient;
    
    // Security parameters
    uint256 public constant MAX_DAILY_VOLUME = 10000 ether;
    uint256 public constant MIN_TIMELOCK = 2 hours;
    uint256 public constant MAX_TIMELOCK = 72 hours;
    
    uint256 public dailyVolume;
    uint256 public lastVolumeReset;
    bool public emergencyShutdown;
    
    // Analytics
    uint256 public totalSwaps;
    uint256 public totalVolume;
    uint256 public successfulSwaps;
    uint256 public totalFeesCollected;
    
    // Events
    event CrossChainSwapInitiated(
        bytes32 indexed swapId,
        address indexed initiator,
        address token,
        uint256 amount,
        string destinationChain,
        string destinationAddress,
        bytes32 secretHash,
        uint256 timelock
    );
    
    event SwapValidated(
        bytes32 indexed swapId,
        address indexed operator,
        uint256 signatureCount,
        bytes32 merkleRoot
    );
    
    event SwapExecuted(
        bytes32 indexed swapId,
        bytes32 stellarTxHash,
        uint256 networkFee,
        address indexed executor
    );
    
    event SwapCompleted(
        bytes32 indexed swapId,
        bytes32 secret,
        uint256 totalFees
    );
    
    event SwapRefunded(
        bytes32 indexed swapId,
        address indexed initiator,
        uint256 amount,
        string reason
    );
    
    event OperatorRegistered(
        address indexed operator,
        uint256 stake,
        address rewardAddress
    );
    
    event OperatorSlashed(
        address indexed operator,
        uint256 slashAmount,
        string reason
    );
    
    event ChainConfigUpdated(
        string chainName,
        bool supported,
        uint256 minAmount,
        uint256 maxAmount
    );
    
    event EmergencyShutdown(
        bool activated,
        address trigger,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyOperator() {
        require(operators[msg.sender].active, "Not an active operator");
        _;
    }
    
    modifier swapExists(bytes32 _swapId) {
        require(swaps[_swapId].initiator != address(0), "Swap does not exist");
        _;
    }
    
    modifier notEmergencyShutdown() {
        require(!emergencyShutdown, "Emergency shutdown active");
        _;
    }
    
    modifier validChain(string memory _chain) {
        require(supportedChains[_chain].supported, "Chain not supported");
        _;
    }
    
    modifier volumeCheck(uint256 _amount) {
        _updateDailyVolume();
        require(dailyVolume + _amount <= MAX_DAILY_VOLUME, "Daily volume exceeded");
        _;
    }
    
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
        lastVolumeReset = block.timestamp;
        
        // Initialize Stellar testnet configuration
        supportedChains["stellar-testnet"] = ChainConfig({
            supported: true,
            minAmount: 0.001 ether,
            maxAmount: 100 ether,
            confirmationBlocks: 1,
            networkFee: 0.00001 ether, // 0.00001 XLM equivalent
            rpcEndpoint: "https://horizon-testnet.stellar.org"
        });
        
        // Initialize Stellar mainnet configuration
        supportedChains["stellar-mainnet"] = ChainConfig({
            supported: true,
            minAmount: 0.01 ether,
            maxAmount: 1000 ether,
            confirmationBlocks: 3,
            networkFee: 0.00001 ether,
            rpcEndpoint: "https://horizon.stellar.org"
        });
    }
    
    /**
     * @dev Initiate cross-chain swap with enhanced security
     */
    function initiateCrossChainSwap(
        address _token,
        uint256 _amount,
        string calldata _destinationChain,
        string calldata _destinationAddress,
        bytes32 _secretHash,
        uint256 _timelock
    ) 
        external 
        payable
        nonReentrant 
        whenNotPaused 
        notEmergencyShutdown
        validChain(_destinationChain)
        volumeCheck(_amount)
        returns (bytes32 swapId) 
    {
        ChainConfig memory chainConfig = supportedChains[_destinationChain];
        
        require(_amount >= chainConfig.minAmount, "Amount below minimum");
        require(_amount <= chainConfig.maxAmount, "Amount above maximum");
        require(_timelock >= MIN_TIMELOCK && _timelock <= MAX_TIMELOCK, "Invalid timelock");
        require(_secretHash != bytes32(0), "Invalid secret hash");
        require(bytes(_destinationAddress).length > 0, "Invalid destination address");
        
        // Generate unique swap ID
        swapId = keccak256(
            abi.encodePacked(
                msg.sender,
                _token,
                _amount,
                _destinationChain,
                _destinationAddress,
                _secretHash,
                userNonces[msg.sender]++,
                block.timestamp
            )
        );
        
        require(swaps[swapId].initiator == address(0), "Swap already exists");
        
        // Handle ETH vs ERC20
        if (_token == address(0)) {
            require(msg.value == _amount, "ETH amount mismatch");
            ethReserve += _amount;
        } else {
            require(msg.value == 0, "ETH not expected for token swap");
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
            tokenReserves[_token] += _amount;
        }
        
        // Create swap record
        CrossChainSwap storage swap = swaps[swapId];
        swap.initiator = msg.sender;
        swap.token = _token;
        swap.amount = _amount;
        swap.destinationChain = _destinationChain;
        swap.destinationAddress = _destinationAddress;
        swap.secretHash = _secretHash;
        swap.timelock = block.timestamp + _timelock;
        swap.createdAt = block.timestamp;
        swap.state = SwapState.INITIATED;
        swap.requiredSignatures = requiredOperators;
        swap.networkFee = chainConfig.networkFee;
        
        // Update metrics
        totalSwaps++;
        totalVolume += _amount;
        dailyVolume += _amount;
        
        emit CrossChainSwapInitiated(
            swapId,
            msg.sender,
            _token,
            _amount,
            _destinationChain,
            _destinationAddress,
            _secretHash,
            swap.timelock
        );
        
        return swapId;
    }
    
    /**
     * @dev Validate swap by bridge operators
     */
    function validateSwap(
        bytes32 _swapId,
        bytes32 _merkleRoot,
        bytes32[] calldata _merkleProof
    ) 
        external 
        onlyOperator 
        swapExists(_swapId) 
    {
        CrossChainSwap storage swap = swaps[_swapId];
        require(swap.state == SwapState.INITIATED, "Invalid swap state");
        require(!swap.operatorSignatures[msg.sender], "Already validated");
        require(block.timestamp < swap.timelock, "Swap expired");
        
        // Verify Merkle proof for batch validation
        bytes32 leaf = keccak256(abi.encodePacked(_swapId, swap.amount, swap.destinationAddress));
        require(MerkleProof.verify(_merkleProof, _merkleRoot, leaf), "Invalid merkle proof");
        
        // Record operator validation
        swap.operatorSignatures[msg.sender] = true;
        swap.signatureCount++;
        swap.merkleRoot = _merkleRoot;
        
        // Update operator metrics
        operators[msg.sender].totalOperations++;
        
        emit SwapValidated(_swapId, msg.sender, swap.signatureCount, _merkleRoot);
        
        // Check if sufficient signatures collected
        if (swap.signatureCount >= swap.requiredSignatures) {
            swap.state = SwapState.VALIDATED;
        }
    }
    
    /**
     * @dev Execute cross-chain transaction (by authorized operators)
     */
    function executeSwap(
        bytes32 _swapId,
        bytes32 _stellarTxHash
    ) 
        external 
        onlyOperator 
        swapExists(_swapId) 
    {
        CrossChainSwap storage swap = swaps[_swapId];
        require(swap.state == SwapState.VALIDATED, "Not validated");
        require(!processedTxHashes[_stellarTxHash], "Transaction already processed");
        require(block.timestamp < swap.timelock, "Swap expired");
        
        // Mark as executed
        swap.state = SwapState.EXECUTED;
        swap.stellarTxHash = _stellarTxHash;
        processedTxHashes[_stellarTxHash] = true;
        
        // Update operator success metrics
        operators[msg.sender].successfulOperations++;
        
        emit SwapExecuted(_swapId, _stellarTxHash, swap.networkFee, msg.sender);
    }
    
    /**
     * @dev Complete swap by revealing secret
     */
    function completeSwap(
        bytes32 _swapId,
        bytes32 _secret
    ) 
        external 
        swapExists(_swapId) 
    {
        CrossChainSwap storage swap = swaps[_swapId];
        require(swap.state == SwapState.EXECUTED, "Not executed");
        require(keccak256(abi.encodePacked(_secret)) == swap.secretHash, "Invalid secret");
        
        swap.state = SwapState.COMPLETED;
        successfulSwaps++;
        
        // Calculate fees
        uint256 bridgeFeeAmount = (swap.amount * bridgeFee) / 10000;
        uint256 operatorRewardAmount = (swap.amount * operatorReward) / 10000;
        uint256 totalFees = bridgeFeeAmount + operatorRewardAmount;
        
        totalFeesCollected += totalFees;
        
        // Distribute operator rewards
        _distributeOperatorRewards(_swapId, operatorRewardAmount);
        
        emit SwapCompleted(_swapId, _secret, totalFees);
    }
    
    /**
     * @dev Refund expired or failed swaps
     */
    function refundSwap(
        bytes32 _swapId,
        string calldata _reason
    ) 
        external 
        swapExists(_swapId) 
    {
        CrossChainSwap storage swap = swaps[_swapId];
        require(
            swap.state == SwapState.INITIATED || 
            swap.state == SwapState.VALIDATED || 
            swap.state == SwapState.FAILED,
            "Cannot refund"
        );
        require(
            block.timestamp >= swap.timelock || 
            msg.sender == owner() ||
            swap.state == SwapState.FAILED,
            "Not refundable yet"
        );
        require(msg.sender == swap.initiator || msg.sender == owner(), "Not authorized");
        
        swap.state = SwapState.REFUNDED;
        
        // Return funds
        if (swap.token == address(0)) {
            ethReserve -= swap.amount;
            payable(swap.initiator).transfer(swap.amount);
        } else {
            tokenReserves[swap.token] -= swap.amount;
            IERC20(swap.token).safeTransfer(swap.initiator, swap.amount);
        }
        
        emit SwapRefunded(_swapId, swap.initiator, swap.amount, _reason);
    }
    
    /**
     * @dev Register as bridge operator
     */
    function registerOperator(address _rewardAddress) external payable {
        require(msg.value >= operatorStakeAmount, "Insufficient stake");
        require(!operators[msg.sender].active, "Already registered");
        require(_rewardAddress != address(0), "Invalid reward address");
        
        operators[msg.sender] = BridgeOperator({
            active: true,
            stake: msg.value,
            reputation: 1000, // Starting reputation
            totalOperations: 0,
            successfulOperations: 0,
            rewardAddress: _rewardAddress
        });
        
        operatorList.push(msg.sender);
        
        emit OperatorRegistered(msg.sender, msg.value, _rewardAddress);
    }
    
    /**
     * @dev Batch process multiple swaps (gas optimization)
     */
    function batchValidateSwaps(
        bytes32[] calldata _swapIds,
        bytes32 _merkleRoot,
        bytes32[][] calldata _merkleProofs
    ) 
        external 
        onlyOperator 
    {
        require(_swapIds.length == _merkleProofs.length, "Array length mismatch");
        require(_swapIds.length <= 100, "Too many swaps");
        
        for (uint256 i = 0; i < _swapIds.length; i++) {
            this.validateSwap(_swapIds[i], _merkleRoot, _merkleProofs[i]);
        }
    }
    
    // View functions
    function getSwapDetails(bytes32 _swapId) 
        external 
        view 
        returns (
            address initiator,
            address token,
            uint256 amount,
            string memory destinationChain,
            string memory destinationAddress,
            bytes32 secretHash,
            uint256 timelock,
            SwapState state,
            uint256 signatureCount,
            bytes32 stellarTxHash
        ) 
    {
        CrossChainSwap storage swap = swaps[_swapId];
        return (
            swap.initiator,
            swap.token,
            swap.amount,
            swap.destinationChain,
            swap.destinationAddress,
            swap.secretHash,
            swap.timelock,
            swap.state,
            swap.signatureCount,
            swap.stellarTxHash
        );
    }
    
    function getBridgeAnalytics() 
        external 
        view 
        returns (
            uint256 _totalSwaps,
            uint256 _totalVolume,
            uint256 _successfulSwaps,
            uint256 _totalFeesCollected,
            uint256 _dailyVolume,
            uint256 _activeOperators
        ) 
    {
        return (
            totalSwaps,
            totalVolume,
            successfulSwaps,
            totalFeesCollected,
            dailyVolume,
            _getActiveOperatorCount()
        );
    }
    
    function getOperatorInfo(address _operator) 
        external 
        view 
        returns (
            bool active,
            uint256 stake,
            uint256 reputation,
            uint256 totalOperations,
            uint256 successfulOperations,
            uint256 successRate
        ) 
    {
        BridgeOperator storage op = operators[_operator];
        uint256 rate = op.totalOperations > 0 ? 
            (op.successfulOperations * 10000) / op.totalOperations : 10000;
        
        return (
            op.active,
            op.stake,
            op.reputation,
            op.totalOperations,
            op.successfulOperations,
            rate
        );
    }
    
    // Admin functions
    function addSupportedChain(
        string calldata _chainName,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _confirmationBlocks,
        uint256 _networkFee,
        string calldata _rpcEndpoint
    ) external onlyOwner {
        supportedChains[_chainName] = ChainConfig({
            supported: true,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            confirmationBlocks: _confirmationBlocks,
            networkFee: _networkFee,
            rpcEndpoint: _rpcEndpoint
        });
        
        emit ChainConfigUpdated(_chainName, true, _minAmount, _maxAmount);
    }
    
    function updateBridgeFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 100, "Fee too high"); // Max 1%
        bridgeFee = _newFee;
    }
    
    function setRequiredOperators(uint256 _required) external onlyOwner {
        require(_required >= 1 && _required <= operatorList.length, "Invalid requirement");
        requiredOperators = _required;
    }
    
    function slashOperator(address _operator, uint256 _slashAmount, string calldata _reason) external onlyOwner {
        require(operators[_operator].active, "Operator not active");
        require(_slashAmount <= operators[_operator].stake, "Slash amount too high");
        
        operators[_operator].stake -= _slashAmount;
        operators[_operator].reputation = operators[_operator].reputation > 100 ? 
            operators[_operator].reputation - 100 : 0;
        
        // Transfer slashed amount to treasury
        payable(feeRecipient).transfer(_slashAmount);
        
        emit OperatorSlashed(_operator, _slashAmount, _reason);
    }
    
    function setEmergencyShutdown(bool _shutdown) external onlyOwner {
        emergencyShutdown = _shutdown;
        emit EmergencyShutdown(_shutdown, msg.sender, block.timestamp);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Internal functions
    function _distributeOperatorRewards(bytes32 _swapId, uint256 _totalReward) internal {
        uint256 validatorCount = swaps[_swapId].signatureCount;
        if (validatorCount == 0) return;
        
        uint256 rewardPerValidator = _totalReward / validatorCount;
        
        // Distribute to validators
        for (uint256 i = 0; i < operatorList.length; i++) {
            address operator = operatorList[i];
            if (swaps[_swapId].operatorSignatures[operator]) {
                payable(operators[operator].rewardAddress).transfer(rewardPerValidator);
            }
        }
    }
    
    function _updateDailyVolume() internal {
        if (block.timestamp >= lastVolumeReset + 1 days) {
            dailyVolume = 0;
            lastVolumeReset = block.timestamp;
        }
    }
    
    function _getActiveOperatorCount() internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].active) {
                count++;
            }
        }
        return count;
    }
    
    // Emergency functions
    function emergencyWithdraw(address _token) external onlyOwner {
        require(emergencyShutdown, "Emergency shutdown not activated");
        
        if (_token == address(0)) {
            payable(owner()).transfer(address(this).balance);
        } else {
            IERC20(_token).safeTransfer(owner(), IERC20(_token).balanceOf(address(this)));
        }
    }
    
    // Receive function for ETH deposits
    receive() external payable {
        ethReserve += msg.value;
    }
}