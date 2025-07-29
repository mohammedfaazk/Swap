const { Keypair, SorobanRpc, TransactionBuilder, Networks, BASE_FEE, Operation } = require('stellar-sdk');
const fs = require('fs');
const path = require('path');

// Load deployment info
const deploymentPath = path.join(__dirname, '../deployment.json');
if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment info not found. Run deploy.js first.');
    process.exit(1);
}

const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

async function setupContract() {
    console.log('🔧 Setting up StellarBridge Fusion+ for demo...');
    
    // Load deployer keypair
    const keypairPath = path.join(__dirname, '../.deployer-keypair.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const deployerKeypair = Keypair.fromSecret(keypairData.secret);
    
    const server = new SorobanRpc.Server(RPC_URL);
    const contractAddress = deploymentInfo.contractAddress;
    
    try {
        console.log(`📍 Contract Address: ${contractAddress}`);
        
        // Create demo resolver accounts
        const resolvers = [];
        for (let i = 0; i < 3; i++) {
            const resolver = Keypair.random();
            resolvers.push({
                keypair: resolver,
                stake: (2 + i) * 1e7, // 20, 30, 40 XLM in stroops
                reputation: 1000 + (i * 100),
            });
            console.log(`🤖 Demo Resolver ${i + 1}: ${resolver.publicKey()}`);
        }
        
        // Create demo user accounts
        const users = [];
        for (let i = 0; i < 2; i++) {
            const user = Keypair.random();
            users.push(user);
            console.log(`👤 Demo User ${i + 1}: ${user.publicKey()}`);
        }
        
        // Fund accounts from friendbot (testnet only)
        console.log('💰 Funding demo accounts...');
        for (const resolver of resolvers) {
            try {
                const response = await fetch(`https://friendbot.stellar.org?addr=${resolver.keypair.publicKey()}`);
                if (response.ok) {
                    console.log(`✅ Funded resolver: ${resolver.keypair.publicKey()}`);
                } else {
                    console.log(`⚠️  Failed to fund resolver: ${resolver.keypair.publicKey()}`);
                }
            } catch (error) {
                console.log(`⚠️  Error funding resolver: ${error.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        }
        
        for (const user of users) {
            try {
                const response = await fetch(`https://friendbot.stellar.org?addr=${user.publicKey()}`);
                if (response.ok) {
                    console.log(`✅ Funded user: ${user.publicKey()}`);
                } else {
                    console.log(`⚠️  Failed to fund user: ${user.publicKey()}`);
                }
            } catch (error) {
                console.log(`⚠️  Error funding user: ${error.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        }
        
        // Wait for account creation
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Register demo resolvers
        console.log('🤖 Registering demo resolvers...');
        for (let i = 0; i < resolvers.length; i++) {
            const resolver = resolvers[i];
            
            try {
                const account = await server.getAccount(resolver.keypair.publicKey());
                
                const registerTx = new TransactionBuilder(account, {
                    fee: BASE_FEE,
                    networkPassphrase: NETWORK_PASSPHRASE,
                })
                .addOperation(Operation.invokeContract({
                    contract: contractAddress,
                    function: 'register_resolver',
                    args: [
                        resolver.keypair.publicKey(), // resolver address
                        resolver.stake, // stake amount
                    ],
                }))
                .setTimeout(300)
                .build();
                
                const preparedTx = await server.prepareTransaction(registerTx);
                preparedTx.sign(resolver.keypair);
                
                const result = await server.sendTransaction(preparedTx);
                console.log(`✅ Registered resolver ${i + 1}: ${result.hash}`);
                
                // Wait for confirmation
                let status = await server.getTransaction(result.hash);
                while (status.status === 'PENDING') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    status = await server.getTransaction(result.hash);
                }
                
                if (status.status !== 'SUCCESS') {
                    console.log(`⚠️  Resolver ${i + 1} registration may have failed`);
                }
                
            } catch (error) {
                console.log(`⚠️  Error registering resolver ${i + 1}: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Create demo swap data
        console.log('📝 Creating demo swap scenarios...');
        
        const demoSwaps = [
            {
                id: 'demo-swap-1',
                amount: 15_000_000_000, // 150 XLM
                fromChain: 'stellar',
                toChain: 'ethereum',
                status: 'completed',
                user: users[0].publicKey(),
                ethAddress: '0x1234567890123456789012345678901234567890',
            },
            {
                id: 'demo-swap-2', 
                amount: 25_000_000_000, // 250 XLM
                fromChain: 'stellar',
                toChain: 'ethereum',
                status: 'partial_filled',
                user: users[1].publicKey(),
                ethAddress: '0x2345678901234567890123456789012345678901',
            },
            {
                id: 'demo-swap-3',
                amount: 50_000_000_000, // 500 XLM
                fromChain: 'stellar', 
                toChain: 'ethereum',
                status: 'initiated',
                user: users[0].publicKey(),
                ethAddress: '0x3456789012345678901234567890123456789012',
            }
        ];
        
        // Save demo data
        const demoData = {
            contractAddress,
            network: 'testnet',
            resolvers: resolvers.map(r => ({
                publicKey: r.keypair.publicKey(),
                secretKey: r.keypair.secret(),
                stake: r.stake,
                reputation: r.reputation,
            })),
            users: users.map(u => ({
                publicKey: u.publicKey(),
                secretKey: u.secret(),
            })),
            demoSwaps,
            rpcUrl: RPC_URL,
            networkPassphrase: NETWORK_PASSPHRASE,
        };
        
        const demoDataPath = path.join(__dirname, '../demo-data.json');
        fs.writeFileSync(demoDataPath, JSON.stringify(demoData, null, 2));
        
        console.log('\n🎯 Setup Complete!');
        console.log(`📍 Contract: ${contractAddress}`);
        console.log(`🤖 Resolvers: ${resolvers.length} registered`);
        console.log(`👤 Users: ${users.length} created and funded`);
        console.log(`📊 Demo swaps: ${demoSwaps.length} scenarios prepared`);
        console.log(`\n📝 Demo data saved to: ${demoDataPath}`);
        
        console.log('\n🚀 Ready for hackathon demo!');
        console.log('   1. Start the relayer service');
        console.log('   2. Launch the frontend');
        console.log('   3. Demonstrate cross-chain swaps');
        console.log('   4. Show resolver network in action');
        console.log('   5. Win the hackathon! 🏆');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

// Utility function to create test swap
async function createTestSwap(userKeypair, amount, ethAddress) {
    const server = new SorobanRpc.Server(RPC_URL);
    const contractAddress = deploymentInfo.contractAddress;
    
    try {
        const account = await server.getAccount(userKeypair.publicKey());
        
        // Generate test parameters
        const secret = Buffer.from('test-secret', 'utf8');
        const secretHash = require('crypto').createHash('sha256').update(secret).digest();
        const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        const merkleRoot = Buffer.alloc(32, 0); // Zero hash for demo
        
        const swapTx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
        .addOperation(Operation.invokeContract({
            contract: contractAddress,
            function: 'initiate_swap',
            args: [
                userKeypair.publicKey(), // initiator
                'native', // token (XLM)
                amount,
                secretHash,
                timelock,
                Buffer.from(ethAddress.slice(2), 'hex'), // ethereum address
                true, // partial fills enabled
                merkleRoot,
            ],
        }))
        .setTimeout(300)
        .build();
        
        const preparedSwapTx = await server.prepareTransaction(swapTx);
        preparedSwapTx.sign(userKeypair);
        
        const swapResult = await server.sendTransaction(preparedSwapTx);
        return {
            transactionHash: swapResult.hash,
            secret: secret.toString('hex'),
            secretHash: secretHash.toString('hex'),
        };
        
    } catch (error) {
        console.error('Error creating test swap:', error);
        throw error;
    }
}

// Run setup
if (require.main === module) {
    setupContract();
}

module.exports = { setupContract, createTestSwap };
