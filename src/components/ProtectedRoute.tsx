import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { firebaseConfigured } from "../lib/firebase";
import { observeAuth } from "../lib/tasks";

interface ProtectedRouteProps {
  children: (user: User) => React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
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
