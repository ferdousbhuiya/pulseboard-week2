import { Link } from "react-router-dom";
import type { User } from "firebase/auth";

interface AppSelectorProps {
  user: User | null;
  onSignOut: () => void;
}

export default function AppSelector({ user, onSignOut }: AppSelectorProps) {
  return (
    <main className="shell app-selector-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">App Selector</p>
          <h1>Welcome back{user?.displayName ? `, ${user.displayName}` : ""}.</h1>
          <p className="muted">{user?.email}</p>
        </div>
        <button className="ghost-button" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <section className="app-grid">
        <Link to="/pulseboard" className="app-card panel">
          <div className="app-icon">📋</div>
          <h2>PulseBoard</h2>
          <p className="muted">Task management with Firebase</p>
          <span className="app-status">Ready</span>
        </Link>

        <Link to="/pdf-converter" className="app-card panel">
          <div className="app-icon">📄</div>
          <h2>PDF Converter</h2>
          <p className="muted">Professional PDF toolkit</p>
          <span className="app-status">Ready</span>
        </Link>
      </section>
    </main>
  );
}
