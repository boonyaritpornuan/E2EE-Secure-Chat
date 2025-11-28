const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now, strictly for dev
        methods: ["GET", "POST"]
    }
});

// Store room state: roomId -> Set<UserObject>
// UserObject: { socketId, username, publicKey }
const rooms = new Map();
const socketToRoom = new Map();
const allUsers = new Map(); // username -> { socketId, publicKey, username }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, username, publicKey }) => {
        socket.join(roomId);
        socketToRoom.set(socket.id, roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        const roomUsers = rooms.get(roomId);

        // Add user to room state
        const user = { socketId: socket.id, username, publicKey };
        roomUsers.set(socket.id, user);

        // Update global user list (Last write wins for same username)
        allUsers.set(username, user);

        // Notify others in the room
        socket.to(roomId).emit('user-joined', user);

        // Send list of existing users to the new user
        const usersList = Array.from(roomUsers.values()).filter(u => u.socketId !== socket.id);
        socket.emit('room-users', usersList);

        console.log(`User ${username} (${socket.id}) joined room ${roomId}`);
        console.log(`User ${username} (${socket.id}) joined room ${roomId}`);
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
                            console.log(`Room ${roomId} deleted (empty after grace period)`);
                        }
                    }, 10000);
                }
            }
            socketToRoom.delete(socket.id);
            console.log(`User ${socket.id} left room ${roomId}`);
        }
    });

    socket.on('register-user', ({ username, publicKey }) => {
        const user = { socketId: socket.id, username, publicKey };
        allUsers.set(username, user);
        console.log(`User registered globally: ${username}`);
    });

    socket.on('find-user', (username, callback) => {
        const user = allUsers.get(username);
        if (user) {
            callback({ found: true, user });
        } else {
            callback({ found: false });
        }
    });

    socket.on('signal', ({ targetSocketId, signal }) => {
        io.to(targetSocketId).emit('signal', {
            senderSocketId: socket.id,
            signal
        });
    });

    // Direct Encrypted Message Relay
    socket.on('send-message', ({ targetSocketId, targetUsername, payload, senderUsername }) => {
        let finalTargetId = targetSocketId;

        // If targetUsername is provided, look up the latest socket ID
        if (targetUsername) {
            const user = allUsers.get(targetUsername);
            if (user) {
                finalTargetId = user.socketId;
            }
        }

        if (finalTargetId) {
            io.to(finalTargetId).emit('encrypted-message', {
                senderSocketId: socket.id,
                senderUsername, // Relay username
                payload
            });
        } else {
            console.warn(`Target not found: ${targetUsername || targetSocketId}`);
        }
    });

    // Unified File Offer Handler (Supports both Legacy and New Chunk-based)
    socket.on('file-offer', ({ targetSocketId, metadata, fileMetadata }) => {
        // Support both property names
        const finalMetadata = metadata || fileMetadata;

        if (finalMetadata) {
            io.to(targetSocketId).emit('file-offer', {
                senderSocketId: socket.id,
                metadata: finalMetadata, // Standardize on 'metadata' for receiver, or keep original structure if needed
                fileMetadata: finalMetadata // Send both to be safe for all client versions
            });
            console.log(`File offer sent: ${finalMetadata.fileName || finalMetadata.name} from ${socket.id} to ${targetSocketId}`);
        } else {
            console.warn(`Received file-offer with no metadata from ${socket.id}`);
        }
    });

    socket.on('file-response', ({ targetSocketId, accepted }) => {
        io.to(targetSocketId).emit('file-response', {
            senderSocketId: socket.id,
            accepted
        });
    });

    // Direct Chat Request Signal
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
        io.to(targetSocketId).emit('file-accept', {
            transferId
        });
        console.log(`File accepted: ${transferId}`);
    });

    socket.on('file-decline', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-decline', {
            transferId
        });
        console.log(`File declined: ${transferId}`);
    });

    socket.on('file-chunk', ({ targetSocketId, transferId, chunkId, data }) => {
        io.to(targetSocketId).emit('file-chunk', {
            transferId,
            chunkId,
            data
        });
    });

    socket.on('file-complete', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-complete', {
            transferId
        });
        console.log(`File transfer completed: ${transferId}`);
    });

    socket.on('file-cancel', ({ targetSocketId, transferId }) => {
        io.to(targetSocketId).emit('file-cancel', {
            transferId
        });
        console.log(`File transfer cancelled: ${transferId}`);
    });

    socket.on('end-direct-chat', ({ targetSocketId }) => {
        io.to(targetSocketId).emit('end-direct-chat', {
            senderSocketId: socket.id,
            senderUsername: 'User' // Could be enhanced to include actual username
        });
    });

    socket.on('disconnect', () => {
        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
            const roomUsers = rooms.get(roomId);
            if (roomUsers) {
                const user = roomUsers.get(socket.id);
                roomUsers.delete(socket.id);
                socket.to(roomId).emit('user-left', socket.id);

                if (roomUsers.size === 0) {
                    // Grace period: Wait 10 seconds before deleting the room
                    setTimeout(() => {
                        if (rooms.has(roomId) && rooms.get(roomId).size === 0) {
                            rooms.delete(roomId);
                            console.log(`Room ${roomId} deleted (empty after grace period)`);
                        }
                    }, 10000);
                }
            }
            socketToRoom.delete(socket.id);
        }

        // Global cleanup (independent of room)
        for (const [username, user] of allUsers.entries()) {
            if (user.socketId === socket.id) {
                allUsers.delete(username);
                console.log(`Removed ${username} from global registry`);
                break;
            }
        }

        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
