import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Auth() {
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!email || !password) {
      setError("Please enter an email and password.");
      return;
    }

    if (isRegistering) {
      const { error } = await signUp(email, password);

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("Account created successfully!");
    } else {
      const { error } = await signIn(email, password);

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("Logged in successfully!");
    }
  }

  function toggleMode() {
    setIsRegistering((value) => !value);
    setError("");
    setMessage("");
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>{isRegistering ? "Create Account" : "Login"}</h1>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button type="submit">
            {isRegistering ? "Create Account" : "Login"}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        {message && <p className="auth-message">{message}</p>}

        <button type="button" onClick={toggleMode}>
          {isRegistering
            ? "Already have an account? Login"
            : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
