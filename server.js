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
  cors: { origin: "https://chess-mu-lime.vercel.app" }, // confirm this matches your real frontend URL
});

// --- Supabase JWKS setup (ECC signing keys) ---
const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
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
    socket.userId = decoded.sub;
    socket.email = decoded.email;
    next();
  });
});

const rooms = {};
const DEFAULT_MINUTES = 5;

function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function endGame(io, roomId, room, payload) {
  clearRoomTimer(room);
  io.to(roomId).emit("gameOver", payload);
}

function startTimer(io, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  clearRoomTimer(room);

  room.timerInterval = setInterval(() => {
    const turn = room.chess.turn() === "w" ? "white" : "black";
    room.time[turn] -= 1;

    if (room.time[turn] <= 0) {
      room.time[turn] = 0;
      io.to(roomId).emit("timeUpdate", room.time);
      endGame(io, roomId, room, {
        isTimeout: true,
        winner: turn === "white" ? "black" : "white",
      });
      return;
    }

    io.to(roomId).emit("timeUpdate", room.time);
  }, 1000);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id, socket.email);

  socket.on("joinRoom", ({ roomId, minutes }) => {
    if (!rooms[roomId]) {
      const mins = Number(minutes) > 0 ? Number(minutes) : DEFAULT_MINUTES;
      rooms[roomId] = {
        players: [],
        chess: new Chess(),
        time: { white: mins * 60, black: mins * 60 },
        timerInterval: null,
      };
    }

    const room = rooms[roomId];

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
    room.players.push({ id: socket.id, userId: socket.userId });
    socket.roomId = roomId;

    const color = room.players.length === 1 ? "white" : "black";
    socket.color = color;
    socket.emit("color", color);

    socket.emit("boardState", room.chess.fen());
    socket.emit("timeUpdate", room.time);

    io.to(roomId).emit("playerCount", room.players.length);

    if (room.players.length === 2) {
      startTimer(io, roomId);
    }
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

    const nowInCheck = chess.inCheck ? chess.inCheck() : chess.isCheck();
    io.to(roomId).emit("checkStatus", {
      inCheck: nowInCheck,
      turn: chess.turn() === "w" ? "white" : "black",
    });

    if (chess.isGameOver()) {
      let winner = null;
      if (chess.isCheckmate()) {
        // the side who just moved (turnColor) delivered mate
        winner = turnColor;
      }
      endGame(io, roomId, room, {
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: chess.isStalemate(),
        winner,
      });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];
    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      clearRoomTimer(room);
      delete rooms[roomId];
    } else {
      clearRoomTimer(room);
      io.to(roomId).emit("playerCount", room.players.length);
      io.to(roomId).emit("opponentLeft");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});