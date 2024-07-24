import {  Connection,
    PublicKey,
    clusterApiUrl,
    Keypair,
    LAMPORTS_PER_SOL,
    Transaction,
    SystemProgram,
    Account, } from "@solana/web3.js";
import fs from 'fs';
import path from 'path'
import * as bs58 from "bs58";
import * as readline from 'readline';

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let rl: readline.Interface;

function createReadlineInterface() {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
}

function closeReadlineInterface() {
    if (rl) {
        rl.close();
    }
}

async function ask(question: string): Promise<string> {
    createReadlineInterface();
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function getBalance() {
    const {publicKey, secretKey} = await getKeys()
    const connection = new Connection("https://api.devnet.solana.com");
    const feePayer = Keypair.fromSecretKey(secretKey);
    let balance = await connection.getBalance(feePayer.publicKey);
    console.log('Balance: ', balance / LAMPORTS_PER_SOL, 'SOL');
}


async function getKeys(keyFile='private-key.txt'): Promise<{publicKey: string, secretKey: Uint8Array}> {
    let publicKey, secretKey
    if (!fs.existsSync(keyFile)) {
        ;({publicKey, secretKey} = await generateKey());
    }
    else {
        console.log('Loading keys...\n')
        
        const privateRaw = fs.readFileSync(keyFile, 'utf8')
        const keypair = Keypair.fromSecretKey(bs58.default.decode(privateRaw.toString()))
        publicKey = new PublicKey(keypair.publicKey).toString();
        secretKey = keypair.secretKey
        
        console.log('public-key: \x1b[32m', publicKey, '\x1b[0m')
    }
    return {publicKey, secretKey}
}

async function generateKey(keyFile='private-key.txt'): Promise<{publicKey: string, secretKey: Uint8Array}>  {
    console.log('Generating keys...\n')

    const newPair = new Keypair()
    const publicKey = new PublicKey(newPair.publicKey).toString();
    const secretKey = newPair.secretKey
    const privateKeyEncoded = bs58.default.encode(secretKey) 
    fs.writeFileSync(keyFile, privateKeyEncoded)

    console.log('public-key: \x1b[32m', publicKey, '\x1b[0m')
    console.log('\nYour private key have been stored in the \x1b[1mprivate-key.txt\x1b[0m file, bs58 encoded, at the root.')
    return {publicKey, secretKey}
}

async function sendSol(){
    try {
        createReadlineInterface();
        const connection = new Connection("https://api.devnet.solana.com");
        const {publicKey, secretKey} = await getKeys()
        const feePayer = Keypair.fromSecretKey(secretKey);
        const balance = await connection.getBalance(feePayer.publicKey)
        console.log('Balance: ', balance / LAMPORTS_PER_SOL, 'SOL')
        
        const receiverAdd = await ask('Enter the receiver address: ')
        const solToSendStr = await ask('Enter the amount of SOL to send: ');
        const solToSend = parseFloat(solToSendStr);

        if (isNaN(solToSend)) {
            throw new Error('Invalid amount entered');
        }

        let tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: feePayer.publicKey,
                toPubkey: new PublicKey(receiverAdd),
                lamports: solToSend * LAMPORTS_PER_SOL,
            })
        );
        tx.feePayer = feePayer.publicKey;
        
        let txhash = await connection.sendTransaction(tx, [feePayer]);
        console.log(`Transfer successfull !\nTransaction hash: \x1b[1m${txhash}\x1b[0m`);
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        closeReadlineInterface();
    }
}

async function airdrop(){
    try {
        createReadlineInterface();
        const {publicKey, secretKey} = await getKeys()
        const connection = new Connection("https://api.devnet.solana.com");
        const feePayer = Keypair.fromSecretKey(secretKey);

        let initialBalance = await connection.getBalance(feePayer.publicKey);
        console.log(`Initial balance: ${initialBalance / LAMPORTS_PER_SOL} SOL`);

        const solToAirdropStr = await ask('How many sol do you want : ')
        const solToAirdrop = parseFloat(solToAirdropStr)

        const airdropSignature = await connection.requestAirdrop(
            feePayer.publicKey,
            solToAirdrop * LAMPORTS_PER_SOL
        );

        await connection.confirmTransaction(airdropSignature);

        await sleep(100)
        
        let newBalance = await connection.getBalance(feePayer.publicKey);
        console.log(`New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);

        console.log(`Airdrop successful. Transaction signature: ${airdropSignature}`);
    } catch (error) {
        console.error('Airdrop failed:', error);
    } finally {
        closeReadlineInterface();
    }
}


async function main(){
    switch (process.argv[2]) {
        case 'generate-key':
            generateKey()
            break
        case 'airdrop':
            airdrop()
            break
        case 'send':
            sendSol()
            break
        case 'balance':
            getBalance()
            break
        default:
            console.log('Usage:\n\x1b[32m\tgenerate-key\x1b[0m: generate public and private key.\n\x1b[32m\tairdrop\x1b[0m: process to the airdrop of registered address.\n\x1b[32m\tsend\x1b[0m: send sol to an address.\n\x1b[32m\tbalance\x1b[0m: display account balance.')
    }
    return 0
}

main()