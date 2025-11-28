const io = require('socket.io-client');

const socket = io('http://localhost:3001');
const USERNAME = 'BotSender';
const ROOM = 'stableRoom';

const dummyKey = {
    kty: "RSA",
    e: "AQAB",
    n: "dummy_n_sender",
    alg: "RSA-OAEP-256",
    ext: true,
    key_ops: ["encrypt"]
};

// Create a dummy file buffer (50KB)
const FILE_SIZE = 50 * 1024;
const fileBuffer = Buffer.alloc(FILE_SIZE);
for (let i = 0; i < FILE_SIZE; i++) fileBuffer[i] = i % 256;

const CHUNK_SIZE = 16 * 1024;
const totalChunks = Math.ceil(FILE_SIZE / CHUNK_SIZE);

socket.on('connect', () => {
    console.log('BotSender connected');
    socket.emit('register-user', { username: USERNAME, publicKey: dummyKey });
    socket.emit('join-room', { roomId: ROOM, username: USERNAME, publicKey: dummyKey });
});

socket.on('room-users', (users) => {
    // Find a real user (not BotSender and not UserB from test_client)
    const target = users.find(u => u.username !== USERNAME && u.username !== 'UserB');
    if (target) {
        console.log(`Found target ${target.username} (${target.socketId})`);
        startTransfer(target.socketId);
    }
});

socket.on('user-joined', (user) => {
    if (user.username !== USERNAME && user.username !== 'UserB') {
        console.log(`User joined: ${user.username}`);
        startTransfer(user.socketId);
    }
});

let transferStarted = false;
function startTransfer(targetSocketId) {
    if (transferStarted) return;
    transferStarted = true;

    const transferId = `transfer-${Date.now()}`;
    const fileName = `test_image_${Date.now()}.png`; // Use .png to test extension
    console.log(`Offering file ${fileName} to ${targetSocketId}`);

    socket.emit('file-offer', {
        targetSocketId,
        metadata: {
            transferId,
            fileName,
            fileSize: FILE_SIZE,
            fileType: 'image/png',
            totalChunks
        }
    });

    socket.on('file-accept', async (data) => {
        if (data.transferId === transferId) {
            console.log('File accepted! Sending chunks...');
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, FILE_SIZE);
                const chunk = fileBuffer.slice(start, end);

                socket.emit('file-chunk', {
                    targetSocketId,
                    transferId,
                    chunkId: i,
                    data: chunk
                });
                await new Promise(r => setTimeout(r, 10));
            }
            socket.emit('file-complete', { targetSocketId, transferId });
            console.log('File transfer complete!');
            // Keep running to see if client complains or anything
        }
    });
}
