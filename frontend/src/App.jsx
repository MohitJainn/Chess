import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getSocket } from "./socket";
import { supabase } from './supabaseClient';
import Auth from "./Auth";
import Lobby from "./Lobby";

function App() {
  console.log("APP RENDERED");

  // --- Auth state ---
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- View routing ---
  const [view, setView] = useState("lobby"); // "lobby" | "game"

  // --- Game state ---
  const game = useRef(new Chess());
  const [position, setPosition] = useState(game.current.fen());
  const [roomId, setRoomId] = useState("");
  const [playerColor, setPlayerColor] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [gameOverMsg, setGameOverMsg] = useState("");
  const [socket, setSocket] = useState(null);

  // --- Restore session on load ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Create socket once session exists ---
  useEffect(() => {
    if (session) {
      const s = getSocket(session.access_token);
      setSocket(s);
    }
  }, [session]);

  // --- Socket event listeners ---
  useEffect(() => {
    if (!socket) return;

    const savedRoom = sessionStorage.getItem("roomId");
    if (savedRoom) {
      setRoomId(savedRoom);
      socket.emit("joinRoom", savedRoom);
    }

    socket.on("color", (color) => {
      setPlayerColor(color);
      setJoined(true);
      sessionStorage.setItem("playerColor", color);
    });

    socket.on("playerCount", (count) => {
      setPlayerCount(count);
    });

    socket.on("roomFull", () => {
      alert("Room Full");
    });

    socket.on("boardState", (fen) => {
      game.current.load(fen);
      setPosition(game.current.fen());
    });

    socket.on("move", (move) => {
      try {
        const result = game.current.move(move);
        if (result) setPosition(game.current.fen());
      } catch (e) {
        console.log("Opponent move error:", e.message);
      }
    });

    socket.on("invalidMove", (reason) => {
      try { game.current.undo(); } catch (e) {}
      setPosition(game.current.fen());
      setStatusMsg(reason);
      setTimeout(() => setStatusMsg(""), 2000);
    });

    socket.on("gameOver", ({ isCheckmate, isDraw, isStalemate }) => {
      if (isCheckmate) setGameOverMsg("Checkmate!");
      else if (isStalemate) setGameOverMsg("Stalemate — draw.");
      else if (isDraw) setGameOverMsg("Game drawn.");
      sessionStorage.clear();
    });

    return () => {
      socket.off("color");
      socket.off("playerCount");
      socket.off("roomFull");
      socket.off("boardState");
      socket.off("move");
      socket.off("invalidMove");
      socket.off("gameOver");
    };
  }, [socket]);

  // --- Plain functions (not hooks, safe to define anywhere) ---
  const joinRoom = () => {
    if (!roomId.trim()) return;
    sessionStorage.setItem("roomId", roomId);
    socket.emit("joinRoom", roomId);
  };

  function isMyTurn() {
    const turn = game.current.turn() === "w" ? "white" : "black";
    return turn === playerColor;
  }

  function onDrop({ sourceSquare, targetSquare }) {
    if (!joined || !isMyTurn() || gameOverMsg || !targetSquare) return false;

    const move = { from: sourceSquare, to: targetSquare, promotion: "q" };
    let result;
    try {
      result = game.current.move(move);
    } catch (err) {
      return false;
    }

    if (result === null) return false;

    setPosition(game.current.fen());
    socket.emit("move", { roomId, move });
    return true;
  }

  // --- Render logic (all hooks already declared above this point) ---
  if (authLoading) return <p>Loading...</p>;
  if (!session) return <Auth />;

  if (view === "lobby") {
    return (
      <Lobby
        userEmail={session.user.email}
        onSelect={(key) => { if (key === "play") setView("game"); }}
        onLogout={() => supabase.auth.signOut()}
      />
    );
  }

  return (
    <div>
      <h1>Chess App</h1>

      <button onClick={() => setView("lobby")}>← Back to lobby</button>

      {!joined && (
        <>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </>
      )}

      <h2>Color: {playerColor || "—"}</h2>
      <h2>Players: {playerCount}</h2>
      {joined && playerCount < 2 && (
        <p>Waiting for opponent to join room <b>{roomId}</b>...</p>
      )}
      {statusMsg && <p style={{ color: "red" }}>{statusMsg}</p>}
      {gameOverMsg && <h2>{gameOverMsg}</h2>}

      <Chessboard
        options={{
          position: position,
          onPieceDrop: onDrop,
          boardOrientation: playerColor || "white",
          allowDragging: joined && !gameOverMsg,
        }}
      />
    </div>
  );
}

export default App;