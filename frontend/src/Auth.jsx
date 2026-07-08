import { useState } from "react";
import { supabase } from './supabaseClient';
import "./Auth.css";

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-checker">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <div className="auth-body">
          <div className="auth-glyph">♞</div>
          <h1 className="auth-title">{isSignUp ? "Create account" : "Welcome back"}</h1>
          <p className="auth-subtitle">
            {isSignUp ? "Set up your board" : "Sign in to keep playing"}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="auth-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Sign up" : "Log in"}
            </button>
          </form>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-switch">
            <p className="auth-switch-text">
              {isSignUp ? "Already have an account?" : "New here?"}
            </p>
            <button className="auth-switch-btn" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? "Log in instead" : "Create an account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;