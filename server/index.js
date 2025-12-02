const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Security: Restrict CORS to allowed domains
// For mobile/desktop apps (Capacitor/Electron), origin might be 'file://' or 'http://localhost'
// In production, you might want to restrict this, but for a public app, allowing all or specific schemes is needed.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["*"];

app.use(cors({
    origin: ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS,
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    },
    // Heartbeat configuration for stability
    pingTimeout: 10000, // 10 seconds (Reduced from 60s to detect ghost sessions faster)
    pingInterval: 5000  // 5 seconds
});

// --- Version Control ---
const MIN_SUPPORTED_VERSION = '1.0.0'; // Oldest allowed version (Force Update)
const LATEST_VERSION = '1.0.1';        // Current latest version (Soft Update)

// --- State Management ---
// Store room state: roomId -> Set<UserObject>
const rooms = new Map();
const socketToRoom = new Map();
const allUsers = new Map(); // username -> { socketId, publicKey, username }

// --- Server Stats ---
const stats = {
    totalVisits: 0,
    activeUsers: 0,
    startTime: Date.now()
};

// --- Rate Limiting (Simple Token Bucket per Socket) ---
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_REQUESTS_PER_WINDOW = 10; // 10 events per second
const socketRateLimits = new Map(); // socketId -> { count, lastReset }
const ipConnectionCounts = new Map(); // ip -> count

const checkRateLimit = (socketId) => {
    const now = Date.now();
    let limitData = socketRateLimits.get(socketId);

    if (!limitData) {
        limitData = { count: 0, lastReset: now };
        socketRateLimits.set(socketId, limitData);
    }

    if (now - limitData.lastReset > RATE_LIMIT_WINDOW) {
        limitData.count = 0;
        limitData.lastReset = now;
    }

    limitData.count++;
    return limitData.count <= MAX_REQUESTS_PER_WINDOW;
};

// --- Input Validation Helpers ---
const isValidUsername = (username) => {
    return typeof username === 'string' &&
        username.length >= 3 &&
        username.length <= 20 &&
        /^[a-zA-Z0-9_#\-\s]+$/.test(username);
};

const isValidRoomId = (roomId) => {
    return typeof roomId === 'string' &&
        roomId.length >= 1 &&
        roomId.length <= 50;
};

io.on('connection', (socket) => {
    // console.log('User connected:', socket.id); // Privacy: Reduced logging

    // --- Version Check ---
    const clientVersion = socket.handshake.query.version;

    // Helper to compare versions: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
    const compareVersions = (v1, v2) => {
        if (!v1 || !v2) return 0;
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    };

    // 1. Force Update Check
    if (compareVersions(clientVersion, MIN_SUPPORTED_VERSION) < 0) {
        socket.emit('force-update', { minVersion: MIN_SUPPORTED_VERSION });
        socket.disconnect(true);
        return;
    }

    // 2. Soft Update Check
    if (compareVersions(clientVersion, LATEST_VERSION) < 0) {
        socket.emit('soft-update', { latestVersion: LATEST_VERSION });
    }

    // --- Anti-Spam & DoS Protection ---
    const MAX_GLOBAL_CONNECTIONS = 100; // Max users server-wide
    const MAX_CONNECTIONS_PER_IP = 5;   // Max tabs/clients per IP

    // 1. Global Limit Check
    if (io.engine.clientsCount > MAX_GLOBAL_CONNECTIONS) {
        socket.emit('error', 'Server is full. Please try again later.');
        socket.disconnect(true);
        return;
    }

    // 2. IP Rate Limiting
    const clientIp = socket.handshake.address;
    const currentConnections = ipConnectionCounts.get(clientIp) || 0;

    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
        socket.emit('error', 'Too many connections from your IP.');
        socket.disconnect(true);
        return;
    }

    // Track connection
    ipConnectionCounts.set(clientIp, currentConnections + 1);

    stats.totalVisits++;
    stats.activeUsers++;

    // Rate Limit Middleware for this socket
    socket.use(([event, ...args], next) => {
        if (!checkRateLimit(socket.id)) {
            // console.warn(`Rate limit exceeded for ${socket.id}`);
            return; // Drop event
        }
        next();
    });

    socket.on('register-user', ({ username, publicKey }) => {
        if (!isValidUsername(username)) {
            socket.emit('error', 'Invalid username format.');
            return;
        }

        // Username Uniqueness Check
        if (allUsers.has(username)) {
            const existingUser = allUsers.get(username);

            if (existingUser.socketId !== socket.id) {
                // Allow Reclaim if same IP (Fix for refresh/ghost sessions)
                if (existingUser.ip === clientIp) {
                    const oldSocket = io.sockets.sockets.get(existingUser.socketId);
                    if (oldSocket) {
                        oldSocket.emit('error', 'New connection detected. Disconnecting old session.');
                        oldSocket.disconnect(true);
                    }
                    // Proceed to overwrite
                } else {
                    socket.emit('error', 'Username already taken.');
                    socket.disconnect(true); // Force disconnect
                    return;
                }
            }
        }

        const user = { socketId: socket.id, username, publicKey, ip: clientIp };
        allUsers.set(username, user);
        // console.log(`User registered: ${username}`); // Privacy: Reduced logging
    });

    socket.on('join-room', ({ roomId, username, publicKey }) => {
        if (!isValidRoomId(roomId) || !isValidUsername(username)) {
            return;
        }

        // Double check uniqueness enforcement
        if (allUsers.has(username) && allUsers.get(username).socketId !== socket.id) {
            const existingUser = allUsers.get(username);
            // Allow Reclaim if same IP
            if (existingUser.ip === clientIp) {
                const oldSocket = io.sockets.sockets.get(existingUser.socketId);
                if (oldSocket) {
                    oldSocket.emit('error', 'New connection detected. Disconnecting old session.');
                    oldSocket.disconnect(true);
                }
            } else {
                socket.emit('error', 'Username taken.');
                socket.disconnect();
                return;
            }
        }

        socket.join(roomId);
        socketToRoom.set(socket.id, roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        const roomUsers = rooms.get(roomId);

        // Add user to room state
        const user = { socketId: socket.id, username, publicKey, ip: clientIp };
        roomUsers.set(socket.id, user);
        allUsers.set(username, user); // Ensure global registry is updated

        // Notify others in the room
        socket.to(roomId).emit('user-joined', user);

        // Send list of existing users to the new user
        const usersList = Array.from(roomUsers.values()).filter(u => u.socketId !== socket.id);
        socket.emit('room-users', usersList);
    });

    socket.on('leave-room', () => {
        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
            const roomUsers = rooms.get(roomId);
            if (roomUsers) {
                roomUsers.delete(socket.id);
                socket.to(roomId).emit('user-left', socket.id);

                if (roomUsers.size === 0) {
                    setTimeout(() => {
                        if (rooms.has(roomId) && rooms.get(roomId).size === 0) {
                            rooms.delete(roomId);
                        }
                    }, 10000);
                }
            }
            socketToRoom.delete(socket.id);
        }
    });

    socket.on('find-user', (username, callback) => {
        if (typeof callback !== 'function') return;
        const user = allUsers.get(username);
        if (user) {
            callback({ found: true, user });
        } else {
            callback({ found: false });
        }
    });

    // Direct Encrypted Message Relay
    socket.on('send-message', ({ targetSocketId, targetUsername, payload, senderUsername }) => {
        let finalTargetId = targetSocketId;

        if (targetUsername) {
            const user = allUsers.get(targetUsername);
            if (user) {
                finalTargetId = user.socketId;
            }
        }

        if (finalTargetId) {
            io.to(finalTargetId).emit('encrypted-message', {
                senderSocketId: socket.id,
                senderUsername,
                payload
            });
        }
    });

    // Unified File Offer Handler
    socket.on('file-offer', ({ targetSocketId, metadata, fileMetadata }) => {
        const finalMetadata = metadata || fileMetadata;
        if (finalMetadata) {
            // Privacy: Do not log filename or metadata
            io.to(targetSocketId).emit('file-offer', {
                senderSocketId: socket.id,
                metadata: finalMetadata,
                fileMetadata: finalMetadata
            });
        }
    });

    socket.on('file-response', ({ targetSocketId, accepted }) => {
        io.to(targetSocketId).emit('file-response', {
            senderSocketId: socket.id,
            accepted
        });
    });

    socket.on('direct-chat-request', ({ targetUsername, senderUsername }) => {
        const targetUser = allUsers.get(targetUsername);
        if (targetUser) {
            io.to(targetUser.socketId).emit('direct-chat-request', {
                senderSocketId: socket.id,
                senderUsername
            });
        }
    });

    socket.on('file-accept', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-accept', { transferId });
    });

    socket.on('file-decline', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-decline', { transferId });
    });

    socket.on('file-chunk', ({ targetSocketId, transferId, chunkId, data }) => {
        // Basic DoS check: Chunk size limit (e.g., 65KB)
        if (data && data.byteLength > 66000) {
            // Drop oversized chunks silently or disconnect
            return;
        }
        io.to(targetSocketId).emit('file-chunk', {
            transferId,
            chunkId,
            data
        });
    });

    socket.on('file-complete', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-complete', { transferId });
    });

    socket.on('file-cancel', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-cancel', { transferId });
    });

    socket.on('end-direct-chat', ({ targetSocketId }) => {
        io.to(targetSocketId).emit('end-direct-chat', {
            senderSocketId: socket.id,
            senderUsername: 'User'
        });
    });

    // Typing Indicators
    socket.on('typing', ({ targetSocketId, targetRoomId }) => {
        if (targetSocketId) {
            io.to(targetSocketId).emit('typing', { senderSocketId: socket.id });
        } else if (targetRoomId) {
            socket.to(targetRoomId).emit('typing', { senderSocketId: socket.id });
        }
    });

    socket.on('stop-typing', ({ targetSocketId, targetRoomId }) => {
        if (targetSocketId) {
            io.to(targetSocketId).emit('stop-typing', { senderSocketId: socket.id });
        } else if (targetRoomId) {
            socket.to(targetRoomId).emit('stop-typing', { senderSocketId: socket.id });
        }
    });

    // Admin Stats Endpoint (Optional, for debugging)
    socket.on('get-stats', (callback) => {
        if (typeof callback === 'function') {
            callback(stats);
        }
    });

    socket.on('disconnect', () => {
        stats.activeUsers = Math.max(0, stats.activeUsers - 1);
        socketRateLimits.delete(socket.id);

        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
            const roomUsers = rooms.get(roomId);
            if (roomUsers) {
                roomUsers.delete(socket.id);
                socket.to(roomId).emit('user-left', socket.id);

                if (roomUsers.size === 0) {
                    setTimeout(() => {
                        if (rooms.has(roomId) && rooms.get(roomId).size === 0) {
                            rooms.delete(roomId);
                        }
                    }, 10000);
                }
            }
            socketToRoom.delete(socket.id);
        }

        // Global cleanup
        for (const [username, user] of allUsers.entries()) {
            if (user.socketId === socket.id) {
                allUsers.delete(username);
                break;
            }
        }

        // Release IP slot
        const currentCount = ipConnectionCounts.get(clientIp) || 0;
        if (currentCount > 0) {
            ipConnectionCounts.set(clientIp, currentCount - 1);
        }
        if (ipConnectionCounts.get(clientIp) === 0) {
            ipConnectionCounts.delete(clientIp);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
    console.log(`Allowed Origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
