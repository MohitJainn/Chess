const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

process.on("uncaughtException", (err) => {
  console.error("SERVER CRASH:", err.message, err.stack);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "https://chess-mu-lime.vercel.app" }, // <-- confirm this matches your actual Vercel URL
});

// --- Supabase JWKS setup (for ECC/asymmetric signing keys) ---
const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token"));

  jwt.verify(token, getKey, { algorithms: ["ES256"] }, (err, decoded) => {
    if (err) {
      console.log("JWT verify error:", err.message);
      return next(new Error("Invalid token"));
    }
    socket.userId = decoded.sub; // Supabase user ID
    socket.email = decoded.email;
    next();
  });
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id, socket.email);

  socket.on("joinRoom", (roomId) => {
  if (!rooms[roomId]) {
    rooms[roomId] = { players: [], chess: new Chess() };
  }

  const room = rooms[roomId];

  // Reject if this same user is already in the room (e.g. duplicate tab)
  const alreadyIn = room.players.some((p) => p.userId === socket.userId);
  if (alreadyIn) {
    socket.emit("roomFull", "You're already in this room");
    return;
  }

  if (room.players.length >= 2) {
    socket.emit("roomFull");
    return;
  }

  socket.join(roomId);
  room.players.push({ id: socket.id, userId: socket.userId }); // store both

  socket.roomId = roomId;

  const color = room.players.length === 1 ? "white" : "black";
  socket.color = color;
  socket.emit("color", color);

  socket.emit("boardState", room.chess.fen());

  io.to(roomId).emit("playerCount", room.players.length);
});
  socket.on("move", ({ roomId, move }) => {
    const room = rooms[roomId];
    if (!room) return;

    const chess = room.chess;
    const turnColor = chess.turn() === "w" ? "white" : "black";

    if (socket.color !== turnColor) {
      socket.emit("invalidMove", "Not your turn");
      return;
    }

    const result = chess.move(move);
    if (result === null) {
      socket.emit("invalidMove", "Illegal move");
      return;
    }

    socket.to(roomId).emit("move", move);

    if (chess.isGameOver()) {
      io.to(roomId).emit("gameOver", {
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: chess.isStalemate(),
      });
    }
  });

  socket.on("disconnect", () => {
  const roomId = socket.roomId;
  if (!roomId || !rooms[roomId]) return;

  rooms[roomId].players = rooms[roomId].players.filter(
    (p) => p.id !== socket.id
  );

  if (rooms[roomId].players.length === 0) {
    delete rooms[roomId];
  } else {
    io.to(roomId).emit("playerCount", rooms[roomId].players.length);
  }
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});