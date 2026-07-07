import { useState } from "react";
import {supabase} from './supabaseClient';

function Auth(){
    const [email,setEmail]=useState("");
    const [password,setPassword]=useState("");
    const [loading,setLoading]=useState(false);
    const [isSignUp,setIsSignUp]=useState(false);
    const [error,setError]=useState("");

    const handleSubmit=async (e)=>{
        e.preventDefault();
        setError("");
        const error=isSignUp?await supabase.auth.signUp({email,password})
        : await supabase.auth.signInWithPassword({email,password});
        if(error) setError(error.message);
        setLoading(false);
    };
    return (
    <div>
      <h2>{isSignUp ? "Sign Up" : "Log In"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Log In"}
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
      </button>
    </div>
  );
}
export default Auth;