const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startStreamBtn = document.getElementById('startStream');
const stopStreamBtn = document.getElementById('stopStream');

let localStream;
let peerConnection;
let isStreamer = false;

console.log('Initializing live streaming...');

// Configuration for WebRTC (STUN and TURN servers)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }
    ]
};

// Socket.io connection events
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});
socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

// Create peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(iceServers);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { to: Object.keys(socket.io.engine.clients)[0], candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

// Start streaming (streamer)
startStreamBtn.addEventListener('click', async () => {
    try {
        console.log('Requesting media access...');
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        isStreamer = true;

        createPeerConnection();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { to: Object.keys(socket.io.engine.clients)[0], offer: offer });

        startStreamBtn.disabled = true;
        stopStreamBtn.disabled = false;
        console.log('Streaming started successfully.');
    } catch (error) {
        console.error('Error starting stream:', error.name, error.message);
        alert('Failed to start streaming. Check camera/microphone permissions or ensure a camera is connected.');
    }
});

// Stop streaming
stopStreamBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    startStreamBtn.disabled = false;
    stopStreamBtn.disabled = true;
    console.log('Streaming stopped.');
});

// Handle incoming offer (viewer)
socket.on('offer', async (data) => {
    if (!isStreamer) {
        console.log('Received offer from streamer:', data.from);
        createPeerConnection();

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', { to: data.from, answer: answer });
            console.log('Sent answer to streamer.');
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }
});

// Handle incoming answer (streamer)
socket.on('answer', async (data) => {
    if (isStreamer) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('Received answer from viewer.');
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }
});

// Handle ICE candidates
socket.on('ice-candidate', async (data) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('Added ICE candidate.');
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
});

// Handle user connections/disconnections
socket.on('user-connected', (data) => {
    console.log('User connected:', data.id);
});

socket.on('user-disconnected', (data) => {
    console.log('User disconnected:', data.id);
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
        console.log('Peer connection closed due to user disconnection.');
    }
});