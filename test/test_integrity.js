const io = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3001';
const ROOM_NAME = 'IntegrityTestRoom';

// Mock Data
const TEST_FILE = {
    name: 'integrity_check.png',
    size: 1024 * 50, // 50KB
    type: 'image/png',
    content: Buffer.alloc(1024 * 50).fill('a')
};

const receiver = io(SERVER_URL);
const sender = io(SERVER_URL);

let receiverState = {
    offersReceived: 0,
    completesReceived: 0,
    chunksReceived: 0,
    transferId: null,
    filename: null
};

console.log('🚀 Starting File Transfer Integrity Test...');

// --- RECEIVER LOGIC ---
receiver.on('connect', () => {
    console.log('✅ Receiver connected');
    receiver.emit('join-room', { roomId: ROOM_NAME, username: 'ReceiverBot', publicKey: { kty: 'RSA', n: 'mock', e: 'AQAB' } });
});

receiver.on('file-offer', (data) => {
    const metadata = data.metadata || data.fileMetadata;
    console.log(`📥 Receiver got Offer: ${metadata.fileName} (ID: ${metadata.transferId})`);

    receiverState.offersReceived++;
    receiverState.transferId = metadata.transferId;
    receiverState.filename = metadata.fileName;

    // Check Filename
    if (metadata.fileName !== TEST_FILE.name) {
        console.error(`❌ FILENAME MISMATCH: Expected ${TEST_FILE.name}, got ${metadata.fileName}`);
    }

    // Accept immediately
    receiver.emit('file-accept', {
        targetSocketId: data.senderSocketId,
        transferId: metadata.transferId
    });
});

receiver.on('file-chunk', () => {
    receiverState.chunksReceived++;
    if (receiverState.chunksReceived % 10 === 0) process.stdout.write('.');
});

receiver.on('file-complete', ({ transferId }) => {
    console.log(`\n✅ Receiver got Complete Signal for ${transferId}`);
    receiverState.completesReceived++;
});

// --- SENDER LOGIC ---
sender.on('connect', () => {
    console.log('✅ Sender connected');
    sender.emit('join-room', { roomId: ROOM_NAME, username: 'SenderBot', publicKey: { kty: 'RSA', n: 'mock', e: 'AQAB' } });
});

sender.on('room-users', (users) => {
    const target = users.find(u => u.username === 'ReceiverBot');
    if (target) {
        console.log(`🎯 Sender found target. Starting transfer...`);
        startTransfer(target.socketId);
    }
});

sender.on('user-joined', (user) => {
    if (user.username === 'ReceiverBot') {
        console.log(`🎯 Receiver joined. Starting transfer...`);
        startTransfer(user.socketId);
    }
});

async function startTransfer(targetSocketId) {
    const transferId = `trans-${Date.now()}`;
    const CHUNK_SIZE = 16 * 1024;
    const totalChunks = Math.ceil(TEST_FILE.size / CHUNK_SIZE);

    sender.emit('file-offer', {
        targetSocketId,
        metadata: {
            transferId,
            fileName: TEST_FILE.name,
            fileSize: TEST_FILE.size,
            fileType: TEST_FILE.type,
            totalChunks
        }
    });

    sender.on('file-accept', async (data) => {
        if (data.transferId === transferId) {
            console.log('📤 Sender got Accept. Sending chunks...');
            for (let i = 0; i < totalChunks; i++) {
                const chunk = TEST_FILE.content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                sender.emit('file-chunk', {
                    targetSocketId,
                    transferId,
                    chunkId: i,
                    data: chunk
                });
                await new Promise(r => setTimeout(r, 10)); // Simulate network delay
            }
            sender.emit('file-complete', { targetSocketId, transferId });
            console.log('📤 Sender finished sending.');
        }
    });
}

// --- EVALUATION ---
setTimeout(() => {
    console.log('\n\n📊 --- TEST RESULTS ---');
    console.log(`Offers Received: ${receiverState.offersReceived} (Expected: 1)`);
    console.log(`Completes Received: ${receiverState.completesReceived} (Expected: 1)`);
    console.log(`Filename: ${receiverState.filename} (Expected: ${TEST_FILE.name})`);

    let passed = true;
    if (receiverState.offersReceived !== 1) {
        console.error('❌ FAILED: Duplicate or missing offers.');
        passed = false;
    }
    if (receiverState.completesReceived !== 1) {
        console.error('❌ FAILED: Duplicate or missing complete signals.');
        passed = false;
    }
    if (receiverState.filename !== TEST_FILE.name) {
        console.error('❌ FAILED: Incorrect filename.');
        passed = false;
    }

    if (passed) {
        console.log('✅✅✅ TEST PASSED: System is STABLE. ✅✅✅');
    } else {
        console.log('❌❌❌ TEST FAILED: Bugs detected. ❌❌❌');
    }

    receiver.disconnect();
    sender.disconnect();
    process.exit(passed ? 0 : 1);
}, 5000); // Run for 5 seconds
