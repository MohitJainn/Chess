import "./Lobby.css";

const SECTIONS = [
  {
    key: "play",
    glyph: "♞",
    title: "Play",
    desc: "Challenge someone in real time, one move at a time.",
    tag: "Ready",
    enabled: true,
  },
  {
    key: "puzzle",
    glyph: "♝",
    title: "Puzzle",
    desc: "Sharpen your eye with tactics pulled from real games.",
    tag: "Coming soon",
    enabled: false,
  },
  {
    key: "learn",
    glyph: "♜",
    title: "Learn",
    desc: "Openings, endgames, and the ideas behind them.",
    tag: "Coming soon",
    enabled: false,
  },
  {
    key: "watch",
    glyph: "♛",
    title: "Watch",
    desc: "Follow games in progress and review finished ones.",
    tag: "Coming soon",
    enabled: false,
  },
];

function Lobby({ userEmail, onSelect, onLogout }) {
  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <div className="lobby-brand">
          <span className="lobby-brand-glyph">♞</span>
          <span className="lobby-brand-name">Chess App</span>
        </div>
        <div className="lobby-user">
          <span className="lobby-user-email">{userEmail}</span>
          <button className="lobby-logout" onClick={onLogout}>Log out</button>
        </div>
      </div>

      <div className="lobby-checker">
        {Array.from({ length: 32 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="lobby-intro">
        <p className="lobby-eyebrow">Lobby</p>
        <h1 className="lobby-heading">What are you in the mood for?</h1>
      </div>

      <div className="lobby-grid">
        {SECTIONS.map((section) => (
          <div
            key={section.key}
            className={`lobby-card ${section.enabled ? "" : "is-disabled"}`}
            onClick={() => section.enabled && onSelect && onSelect(section.key)}
          >
            <div className="lobby-card-glyph">{section.glyph}</div>
            <h2 className="lobby-card-title">{section.title}</h2>
            <p className="lobby-card-desc">{section.desc}</p>
            <div className="lobby-card-footer">
              <span className="lobby-card-tag">{section.tag}</span>
              {section.enabled && <span className="lobby-card-arrow">→</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Lobby;