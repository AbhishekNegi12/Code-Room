import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import ACTIONS from './src/Actions.js';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: isProduction ? process.env.FRONTEND_URL : 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));

// ✅ Basic health check route
app.get('/', (req, res) => {
  res.send('✅ Code Room API is running');
});

// Socket.IO setup
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO logic
const userSocketMap = {};

function getAllConnectedClients(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? Array.from(room).map(socketId => ({
    socketId,
    username: userSocketMap[socketId]
  })) : [];
}

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id]
      });
    });
    delete userSocketMap[socket.id];
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Mode: ${isProduction ? 'Production' : 'Development'}`);
});
