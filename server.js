const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

process.on("uncaughtException", (err) => {
  console.error("SERVER CRASH:", err.message, err.stack);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});


const rooms = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], chess: new Chess() };
    }

    const room = rooms[roomId];

    if (room.players.length >= 2) {
      socket.emit("roomFull");
      return;
    }

    socket.join(roomId);
    room.players.push(socket.id);
    
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
      (id) => id !== socket.id
    );

    if (rooms[roomId].players.length === 0) {
      delete rooms[roomId]; // clean up empty rooms
    } else {
      io.to(roomId).emit("playerCount", rooms[roomId].players.length);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});