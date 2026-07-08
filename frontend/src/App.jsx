import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getSocket } from "./socket";
import { supabase } from './supabaseClient';
import Auth from "./Auth";
import Lobby from "./Lobby";
import "./Game.css";

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const [minutes, setMinutes] = useState(5);
  const [playerColor, setPlayerColor] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [gameOverInfo, setGameOverInfo] = useState(null); // { text, subtext } or null
  const [checkInfo, setCheckInfo] = useState({ inCheck: false, turn: null });
  const [time, setTime] = useState({ white: 0, black: 0 });
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

    socket.on("color", (color) => {
      setPlayerColor(color);
      setJoined(true);
    });

    socket.on("playerCount", (count) => {
      setPlayerCount(count);
    });

    socket.on("roomFull", (msg) => {
      alert(msg || "Room Full");
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

    socket.on("checkStatus", ({ inCheck, turn }) => {
      setCheckInfo({ inCheck, turn });
    });

    socket.on("timeUpdate", (t) => {
      setTime(t);
    });

    socket.on("opponentLeft", () => {
      setStatusMsg("Opponent disconnected");
    });

    socket.on("gameOver", ({ isCheckmate, isDraw, isStalemate, isTimeout, winner }) => {
      let text = "Game over";
      let subtext = "";

      if (isCheckmate) {
        text = "Checkmate";
        subtext = winner ? `${capitalize(winner)} wins` : "";
      } else if (isTimeout) {
        text = "Time's up";
        subtext = winner ? `${capitalize(winner)} wins on time` : "";
      } else if (isStalemate) {
        text = "Stalemate";
        subtext = "Draw";
      } else if (isDraw) {
        text = "Draw";
        subtext = "";
      }

      setGameOverInfo({ text, subtext });
    });

    return () => {
      socket.off("color");
      socket.off("playerCount");
      socket.off("roomFull");
      socket.off("boardState");
      socket.off("move");
      socket.off("invalidMove");
      socket.off("checkStatus");
      socket.off("timeUpdate");
      socket.off("opponentLeft");
      socket.off("gameOver");
    };
  }, [socket]);

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const joinRoom = () => {
    if (!roomId.trim() || !socket) return;
    socket.emit("joinRoom", { roomId, minutes });
  };

  function isMyTurn() {
    const turn = game.current.turn() === "w" ? "white" : "black";
    return turn === playerColor;
  }

  function onDrop({ sourceSquare, targetSquare }) {
    if (!joined || !isMyTurn() || gameOverInfo || !targetSquare) return false;

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

  // --- Find the king square that's currently in check, for highlighting ---
  function getCheckSquareStyles() {
    if (!checkInfo.inCheck) return {};
    const board = game.current.board();
    const kingColor = checkInfo.turn === "white" ? "w" : "b";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === "k" && piece.color === kingColor) {
          const file = "abcdefgh"[c];
          const rank = 8 - r;
          return { [`${file}${rank}`]: { backgroundColor: "rgba(200, 60, 50, 0.55)" } };
        }
      }
    }
    return {};
  }

  // --- Render logic ---
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
    <div className="game-page">
      <div className="game-topbar">
        <button className="game-back" onClick={() => setView("lobby")}>← Lobby</button>
        <h1 className="game-title">Chess</h1>
      </div>

      {!joined && (
        <div className="game-join">
          <input
            className="game-input"
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            className="game-input game-input-narrow"
            type="number"
            min="1"
            placeholder="Minutes"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <button className="game-join-btn" onClick={joinRoom}>Join Room</button>
        </div>
      )}

      {joined && (
        <div className="game-clocks">
          <div className={`game-clock ${checkInfo.turn === "black" ? "is-active" : ""}`}>
            <span className="game-clock-label">Black</span>
            <span className="game-clock-time">{formatTime(time.black)}</span>
          </div>
          <div className={`game-clock ${checkInfo.turn === "white" ? "is-active" : ""}`}>
            <span className="game-clock-label">White</span>
            <span className="game-clock-time">{formatTime(time.white)}</span>
          </div>
        </div>
      )}

      <div className="game-meta">
        <span>Color: {playerColor || "—"}</span>
        <span>Players: {playerCount}</span>
      </div>

      {joined && playerCount < 2 && (
        <p className="game-waiting">Waiting for opponent to join room <b>{roomId}</b>...</p>
      )}
      {statusMsg && <p className="game-status">{statusMsg}</p>}

      <div className="board-wrap">
        <Chessboard
          options={{
            position: position,
            onPieceDrop: onDrop,
            boardOrientation: playerColor || "white",
            allowDragging: joined && !gameOverInfo,
            darkSquareStyle: { backgroundColor: "#7c6a4a" },
            lightSquareStyle: { backgroundColor: "#ede6d6" },
            squareStyles: getCheckSquareStyles(),
          }}
        />
      </div>

      {gameOverInfo && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-glyph">♚</div>
            <h2 className="modal-title">{gameOverInfo.text}</h2>
            {gameOverInfo.subtext && <p className="modal-subtext">{gameOverInfo.subtext}</p>}
            <button className="modal-btn" onClick={() => setView("lobby")}>Back to lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;