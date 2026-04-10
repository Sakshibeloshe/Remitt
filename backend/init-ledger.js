const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const channelName = 'remittancechannel';
const chaincodeName = 'remittance';

// Paths to crypto materials
const cryptoPath = path.resolve(__dirname, '../fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com');
const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'cert.pem');
const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
const peerEndpoint = 'localhost:7051';

async function main() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const client = new grpc.Client(peerEndpoint, grpc.credentials.createSsl(tlsRootCert), { 'grpc.ssl_target_name_override': 'peer0.org1.example.com' });
    
    const credentials = await fs.readFile(certPath);
    const files = await fs.readdir(keyDirectoryPath);
    const privateKey = crypto.createPrivateKey(await fs.readFile(path.resolve(keyDirectoryPath, files[0])));
    
    const gateway = connect({
        client,
        identity: { mspId: 'Org1MSP', credentials },
        signer: signers.newPrivateKeySigner(privateKey),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        
        console.log('\n--> Submitting Transaction: InitLedger...');
        await contract.submitTransaction('InitLedger');
        console.log('*** InitLedger committed successfully! Alice, Bob, and Charlie are instantiated.');
    } catch (error) {
        console.error('*** Failed to initialize:', error);
    } finally {
        gateway.close();
        client.close();
    }
}

main();