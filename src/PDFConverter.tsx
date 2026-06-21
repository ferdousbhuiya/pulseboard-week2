import { Link, useParams, useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import { TOOLS } from "./pdf-tools/catalog";
import { ToolRouter } from "./pdf-tools/router";

const CATEGORY_ORDER = [
  'Organize PDF',
  'Optimize PDF',
  'Convert to PDF',
  'Convert from PDF',
  'Edit PDF',
  'Security PDF',
  'Advanced PDF'
]

interface PDFConverterProps {
  user: User;
  onSignOut: () => void;
}

export default function PDFConverter({ user, onSignOut }: PDFConverterProps) {
  const location = useLocation();
  const { slug } = useParams();
  const isToolPage = location.pathname.includes('/tool/');

  return (
    <main className="shell pdf-converter-shell">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">PDF Converter</p>
          <h1>Welcome back{user.displayName ? `, ${user.displayName}` : ""}.</h1>
          <p className="muted">{user.email}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="ghost-button" to="/">
            ← Apps
          </Link>
          <button className="ghost-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="app">
        {isToolPage && slug ? (
          <>
            <Link to="/pdf-converter" className="back">
              ← Back to all tools
            </Link>
            <div className="tool-page">
              <h2>Tool: {slug}</h2>
              <ToolRouter slug={slug} />
            </div>
          </>
        ) : (
          <>
            <header className="hero">
              <div>
                <p className="eyebrow">Online PDF Converter</p>
                <h1 className="title">Professional PDF Toolkit</h1>
                <p className="subtitle">Use organized tools for convert, edit, secure, and optimize workflows.</p>
              </div>
            </header>

            <div className="tool-section">
              <h2 className="section-title">All PDF Tools ({TOOLS.length} available)</h2>
              <div className="grid">
                {TOOLS.map((tool) => (
                  <Link className="card tool-card" to={`/pdf-converter/tool/${tool.slug}`} key={tool.slug}>
                    <h3>{tool.name}</h3>
                    <p className="hint">{tool.category}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
