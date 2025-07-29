const { Keypair, SorobanRpc, TransactionBuilder, Networks, BASE_FEE, Operation } = require('stellar-sdk');
const fs = require('fs');
const path = require('path');

// Configuration
const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = 'https://soroban-testnet.stellar.org';
const CONTRACT_WASM_PATH = path.join(__dirname, '../target/wasm32-unknown-unknown/release/stellar_bridge.wasm');

async function deployContract() {
    console.log('🚀 Deploying StellarBridge Fusion+ Contract to Stellar...');
    
    // Load or create deployer keypair
    let deployerKeypair;
    const keypairPath = path.join(__dirname, '../.deployer-keypair.json');
    
    if (fs.existsSync(keypairPath)) {
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        deployerKeypair = Keypair.fromSecret(keypairData.secret);
        console.log(`📱 Using existing deployer: ${deployerKeypair.publicKey()}`);
    } else {
        deployerKeypair = Keypair.random();
        fs.writeFileSync(keypairPath, JSON.stringify({
            public: deployerKeypair.publicKey(),
            secret: deployerKeypair.secret()
        }));
        console.log(`🆕 Created new deployer: ${deployerKeypair.publicKey()}`);
        console.log('⚠️  Fund this account with test XLM from: https://laboratory.stellar.org/#account-creator');
        process.exit(0);
    }
    
    // Initialize Soroban RPC client
    const server = new SorobanRpc.Server(RPC_URL);
    
    try {
        // Get account info
        const account = await server.getAccount(deployerKeypair.publicKey());
        console.log(`💰 Account balance: ${account.balances[0]?.balance || '0'} XLM`);
        
        // Read contract WASM
        if (!fs.existsSync(CONTRACT_WASM_PATH)) {
            console.error('❌ Contract WASM not found. Run `cargo build --target wasm32-unknown-unknown --release` first');
            process.exit(1);
        }
        
        const wasmBuffer = fs.readFileSync(CONTRACT_WASM_PATH);
        console.log(`📦 Contract WASM size: ${wasmBuffer.length} bytes`);
        
        // Step 1: Upload contract WASM
        console.log('📤 Uploading contract WASM...');
        
        const uploadTransaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
        .addOperation(Operation.uploadContractWasm({
            wasm: wasmBuffer,
        }))
        .setTimeout(300)
        .build();
        
        const uploadPreparedTx = await server.prepareTransaction(uploadTransaction);
        uploadPreparedTx.sign(deployerKeypair);
        
        const uploadResult = await server.sendTransaction(uploadPreparedTx);
        console.log(`📤 Upload transaction: ${uploadResult.hash}`);
        
        // Wait for upload confirmation
        let uploadStatus = await server.getTransaction(uploadResult.hash);
        while (uploadStatus.status === 'PENDING') {
            console.log('⏳ Waiting for upload confirmation...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            uploadStatus = await server.getTransaction(uploadResult.hash);
        }
        
        if (uploadStatus.status !== 'SUCCESS') {
            console.error('❌ Upload failed:', uploadStatus);
            process.exit(1);
        }
        
        // Extract WASM hash from upload result
        const wasmHash = uploadStatus.returnValue;
        console.log(`✅ Contract WASM uploaded. Hash: ${wasmHash}`);
        
        // Step 2: Deploy contract instance
        console.log('🏗️  Deploying contract instance...');
        
        // Refresh account for new sequence number
        const refreshedAccount = await server.getAccount(deployerKeypair.publicKey());
        
        const deployTransaction = new TransactionBuilder(refreshedAccount, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
        .addOperation(Operation.createStellarAssetContract({
            asset: 'native', // Use native XLM
        }))
        .addOperation(Operation.createContract({
            wasmHash: wasmHash,
            address: deployerKeypair.publicKey(),
        }))
        .setTimeout(300)
        .build();
        
        const deployPreparedTx = await server.prepareTransaction(deployTransaction);
        deployPreparedTx.sign(deployerKeypair);
        
        const deployResult = await server.sendTransaction(deployPreparedTx);
        console.log(`🏗️  Deploy transaction: ${deployResult.hash}`);
        
        // Wait for deploy confirmation
        let deployStatus = await server.getTransaction(deployResult.hash);
        while (deployStatus.status === 'PENDING') {
            console.log('⏳ Waiting for deploy confirmation...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            deployStatus = await server.getTransaction(deployResult.hash);
        }
        
        if (deployStatus.status !== 'SUCCESS') {
            console.error('❌ Deploy failed:', deployStatus);
            process.exit(1);
        }
        
        // Extract contract address
        const contractAddress = deployStatus.returnValue;
        console.log(`🎉 Contract deployed successfully!`);
        console.log(`📍 Contract Address: ${contractAddress}`);
        
        // Step 3: Initialize contract
        console.log('🔧 Initializing contract...');
        
        const finalAccount = await server.getAccount(deployerKeypair.publicKey());
        
        const initTransaction = new TransactionBuilder(finalAccount, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
        .addOperation(Operation.invokeContract({
            contract: contractAddress,
            function: 'initialize',
            args: [deployerKeypair.publicKey()], // Admin address
        }))
        .setTimeout(300)
        .build();
        
        const initPreparedTx = await server.prepareTransaction(initTransaction);
        initPreparedTx.sign(deployerKeypair);
        
        const initResult = await server.sendTransaction(initPreparedTx);
        console.log(`🔧 Initialize transaction: ${initResult.hash}`);
        
        // Wait for initialization
        let initStatus = await server.getTransaction(initResult.hash);
        while (initStatus.status === 'PENDING') {
            console.log('⏳ Waiting for initialization...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            initStatus = await server.getTransaction(initResult.hash);
        }
        
        if (initStatus.status !== 'SUCCESS') {
            console.error('❌ Initialization failed:', initStatus);
            process.exit(1);
        }
        
        console.log('✅ Contract initialized successfully!');
        
        // Save deployment info
        const deploymentInfo = {
            network: 'testnet',
            contractAddress: contractAddress,
            wasmHash: wasmHash,
            deployerPublic: deployerKeypair.publicKey(),
            deployTime: new Date().toISOString(),
            transactions: {
                upload: uploadResult.hash,
                deploy: deployResult.hash,
                initialize: initResult.hash,
            }
        };
        
        const deploymentPath = path.join(__dirname, '../deployment.json');
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        
        console.log('\n🎯 Deployment Summary:');
        console.log(`   Network: Stellar Testnet`);
        console.log(`   Contract: ${contractAddress}`);
        console.log(`   WASM Hash: ${wasmHash}`);
        console.log(`   Deployer: ${deployerKeypair.publicKey()}`);
        console.log(`\n📝 Deployment info saved to: ${deploymentPath}`);
        console.log('\n🏆 StellarBridge Fusion+ is ready for cross-chain magic! ✨');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment
if (require.main === module) {
    deployContract();
}

module.exports = { deployContract };
