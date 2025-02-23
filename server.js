const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (HTML, JavaScript)
app.use(express.static('public'));

// Store connected users
let users = {};

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    // Store user
    users[socket.id] = { id: socket.id };

    // Broadcast new user to all connected users
    io.emit('user-connected', { id: socket.id });

    // Handle offer (from streamer to viewer)
    socket.on('offer', (data) => {
        socket.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
    });

    // Handle answer (from viewer to streamer)
    socket.on('answer', (data) => {
        socket.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
        socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
        io.emit('user-disconnected', { id: socket.id });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});