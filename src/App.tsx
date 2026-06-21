import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "firebase/auth";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { firebaseConfigured } from "./lib/firebase";
import { login, logout, observeAuth, register } from "./lib/tasks";
import AppSelector from "./AppSelector";
import PulseBoard from "./PulseBoard";
import PDFConverter from "./PDFConverter";

type AuthMode = "login" | "register";

function AuthPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    return observeAuth((authUser) => {
      setUser(authUser);
      if (authUser) {
        navigate("/");
      }
    });
  }, [navigate]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }

      setPassword("");
      setDisplayName("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await logout();
    setEmail("");
    setPassword("");
    setDisplayName("");
    setFormKey(prev => prev + 1);
  }

  if (!firebaseConfigured) {
    return (
      <main className="shell">
        <section className="hero-card setup-card">
          <p className="eyebrow">Firebase required</p>
          <h1>Configure the backend before running the app.</h1>
          <p>
            Copy <strong>.env.example</strong> to <strong>.env</strong>, fill in your Firebase project values, and
            enable Email/Password authentication in the Firebase console.
          </p>
          <ul className="setup-list">
            <li>Create a Firestore database.</li>
            <li>Deploy the rules from <strong>firestore.rules</strong>.</li>
            <li>Restart <strong>npm run dev</strong> after adding the environment variables.</li>
          </ul>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell auth-shell">
        <section className="hero-card auth-card">
          <div className="hero-copy">
            <p className="eyebrow">Multi-App Platform</p>
            <h1>Access PulseBoard and PDF Converter with one account.</h1>
            <p>
              Register or log in to access your applications. Data is scoped per user through Firebase Auth and
              Firestore rules.
            </p>
          </div>

          <div className="switcher" role="tablist" aria-label="Authentication mode">
            <button className={authMode === "login" ? "chip active" : "chip"} onClick={() => setAuthMode("login")}>
              Log in
            </button>
            <button
              className={authMode === "register" ? "chip active" : "chip"}
              onClick={() => setAuthMode("register")}
            >
              Register
            </button>
          </div>

          <form key={formKey} className="panel form-panel" onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <label>
                Display name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Alex" />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" required autoComplete="off" />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>
            {authError ? <p className="status error">{authError}</p> : null}
            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? "Working..." : authMode === "register" ? "Create account" : "Log in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return <Navigate to="/" replace />;
}

function ProtectedRoute({ children }: { children: (user: User) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    return observeAuth((authUser) => {
      setUser(authUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <main className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted, #888)", fontSize: "1rem" }}>Loading…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children(user)}</>;
}

export default function App() {
  if (!firebaseConfigured) {
    return (
      <main className="shell">
        <section className="hero-card setup-card">
          <p className="eyebrow">Firebase required</p>
          <h1>Configure the backend before running the app.</h1>
          <p>
            Copy <strong>.env.example</strong> to <strong>.env</strong>, fill in your Firebase project values, and
            enable Email/Password authentication in the Firebase console.
          </p>
          <ul className="setup-list">
            <li>Create a Firestore database.</li>
            <li>Deploy the rules from <strong>firestore.rules</strong>.</li>
            <li>Restart <strong>npm run dev</strong> after adding the environment variables.</li>
          </ul>
        </section>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {(user) => <AppSelector user={user} onSignOut={() => logout()} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/pulseboard"
        element={
          <ProtectedRoute>
            {(user) => <PulseBoard user={user} onSignOut={() => logout()} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/pdf-converter/*"
        element={
          <ProtectedRoute>
            {(user) => <PDFConverter user={user} onSignOut={() => logout()} />}
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}