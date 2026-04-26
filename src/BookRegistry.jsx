/**
 * BookRegistry.jsx
 * Pure component logic — all styles live in registry.css
 *
 * ── Changes from previous version ──────────────────────────────────────────
 * 1. ALL CRUD now goes through json-server (db.json) — no static fallback.
 * 2. Users are also stored in db.json  (/users endpoint).
 * 3. If the server is offline the app shows a friendly "Server Offline" screen
 *    instead of silently falling back to static data.
 * 4. Auto-reset: every 24 h the server calls /reset (handled by reset-server.js)
 *    which restores db.json to its original snapshot.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Usage in main.jsx / index.jsx:
 *   import './registry.css'
 *   import BookRegistry from './BookRegistry'
 *   ReactDOM.createRoot(document.getElementById('root')).render(<BookRegistry />)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import logo from "./assets/logo.png";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE  = import.meta.env.VITE_API_URL;
const BOOKS_URL = `${API_BASE}/books`;
const USERS_URL = `${API_BASE}/users`;
const ROWS      = 15;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt      = d => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const todayStr = () => new Date().toISOString().split("T")[0];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function BookRegistry() {
  // ── Auth ──
  const [screen,  setScreen]  = useState("login"); // "login" | "signup" | "app" | "offline"
  const [lf,      setLf]      = useState({ u: "", p: "" });
  const [sf,      setSf]      = useState({ u: "", p: "", c: "" });
  const [authErr, setAuthErr] = useState("");
  const [who,     setWho]     = useState("");
  const [whoId,   setWhoId]   = useState(null);

  // ── Data ──
  const [books,    setBooks]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [form,     setForm]     = useState({ title:"", author:"", isbn:"", firstRelease:"", latestRelease:"" });
  const [editId,   setEditId]   = useState(null);

  // ── UI ──
  const [search,  setSearch]  = useState("");
  const [sortCol, setSortCol] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [page,    setPage]    = useState(1);
  const [anim,    setAnim]    = useState("");
  const [toast,   setToast]   = useState(null);
  const [confirm, setConfirm] = useState(null);
  const tRef = useRef(null);

  // ── Server health check on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch(BOOKS_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setBooks(d))
      .catch(() => setScreen("offline"));
  }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = msg => {
    clearTimeout(tRef.current);
    setToast(msg);
    tRef.current = setTimeout(() => setToast(null), 2800);
  };

  // ── Fetch books from server ───────────────────────────────────────────────
  const fetchBooks = useCallback(async () => {
    const d = await fetch(BOOKS_URL).then(r => r.json());
    setBooks(d);
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLogin = async e => {
    e.preventDefault();
    try {
      const res  = await fetch(`${USERS_URL}?username=${encodeURIComponent(lf.u)}`);
      const list = await res.json();
      const user = list.find(u => u.username === lf.u && u.password === lf.p);
      if (user) {
        setAuthErr("");
        setWho(user.username);
        setWhoId(user.id);
        setLoading(true);
        await fetchBooks();
        setLoading(false);
        setScreen("app");
      } else {
        setAuthErr("These credentials are not found in the register.");
      }
    } catch {
      setScreen("offline");
    }
  };

  const handleSignup = async e => {
    e.preventDefault();
    if (sf.p !== sf.c) { setAuthErr("Passwords do not match."); return; }
    try {
      // Check if username taken
      const existing = await fetch(`${USERS_URL}?username=${encodeURIComponent(sf.u)}`).then(r => r.json());
      if (existing.length > 0) { setAuthErr("This name is already inscribed."); return; }

      await fetch(USERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: sf.u, password: sf.p }),
      });

      setLf({ u: sf.u, p: sf.p });
      setSf({ u:"", p:"", c:"" });
      setAuthErr("");
      setScreen("login");
      showToast("✦  Account created — please sign in");
    } catch {
      setScreen("offline");
    }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    const payload = { ...form, latestRelease: form.latestRelease || todayStr() };
    try {
      if (editId) {
        await fetch(`${BOOKS_URL}/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(BOOKS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await fetchBooks();
      setForm({ title:"", author:"", isbn:"", firstRelease:"", latestRelease:"" });
      setEditId(null);
      showToast(editId ? "✎  Entry amended" : "✦  Entry inscribed");
    } catch {
      showToast("⚠  Server error — please try again");
    }
  };

  const startEdit = book => {
    setEditId(book.id);
    setForm({
      title:         book.title,
      author:        book.author,
      isbn:          book.isbn          || "",
      firstRelease:  book.firstRelease  || "",
      latestRelease: book.latestRelease || "",
    });
  };

  const doDelete = async () => {
    const { id } = confirm;
    setConfirm(null);
    try {
      await fetch(`${BOOKS_URL}/${id}`, { method: "DELETE" });
      await fetchBooks();
      showToast("✗  Entry struck from record");
    } catch {
      showToast("⚠  Server error — could not delete");
    }
  };

  // ── Row flip animation ────────────────────────────────────────────────────
  const flipRow = e => {
    const tr = e.currentTarget;
    tr.classList.remove("row-flip");
    void tr.offsetWidth;
    tr.classList.add("row-flip");
    tr.addEventListener("animationend", () => tr.classList.remove("row-flip"), { once: true });
  };

  // ── Filter / Sort / Paginate ──────────────────────────────────────────────
  const filtered = books.filter(b =>
    [b.title, b.author, b.isbn].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortCol] ?? "", vb = b[sortCol] ?? "";
    if (sortCol === "id") { va = +va; vb = +vb; }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ?  1 : -1;
    return 0;
  });

  const total    = Math.max(1, Math.ceil(sorted.length / ROWS));
  const pageRows = sorted.slice((page - 1) * ROWS, page * ROWS);

  const goPage = n => {
    if (n === page || n < 1 || n > total) return;
    setAnim("anim-out");
    setTimeout(() => { setPage(n); setAnim("anim-in"); setTimeout(() => setAnim(""), 420); }, 270);
  };

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const arrow  = col => sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "↕";
  const pgNums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(total, page + 2); i++) pgNums.push(i);

  // ═══════════════════════════════════
  // OFFLINE SCREEN
  // ═══════════════════════════════════
  if (screen === "offline") {
    return (
      <div className="cv-root">
        <div className="cv-spine">
          <div className="cv-so">❦</div>
          <div className="cv-st">Bibliotheca · Registrum · Librorum</div>
          <div className="cv-so">✦</div>
        </div>
        <div className="cv-face">
          <div className="cv-inner" />
          <div className="cv-card">
            <div className="cv-logo-wrap">
              <img src={logo} alt="Book Registry" className="cv-logo-img" />
            </div>
            <div className="cv-div" />
            <div className="cv-box" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⚠</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>
                The Register is Unavailable
              </div>
              <div style={{ color: "var(--ink3)", marginBottom: "20px", lineHeight: 1.6 }}>
                The json-server is not running.<br />
                Please start it with:<br />
                <code style={{ background: "var(--parchment2)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.85rem" }}>
                  npx json-server db.json --port 5000
                </code>
              </div>
              <button
                className="cv-btn"
                onClick={() => {
                  setScreen("login");
                  fetch(BOOKS_URL)
                    .then(r => r.json())
                    .then(d => { setBooks(d); })
                    .catch(() => setScreen("offline"));
                }}
              >
                ↺ Retry Connection
              </button>
            </div>
            <div className="cv-div" style={{ marginTop: 16 }} />
            <div className="cv-footnote">Est. MDCCCXCII · All Rights Reserved</div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // COVER (Login / Signup)
  // ═══════════════════════════════════
  if (screen === "login" || screen === "signup") {
    const isL = screen === "login";
    return (
      <div className="cv-root">
        <div className="cv-spine">
          <div className="cv-so">❦</div>
          <div className="cv-st">Bibliotheca · Registrum · Librorum</div>
          <div className="cv-so">✦</div>
        </div>
        <div className="cv-face">
          <div className="cv-inner" />
          <div className="cv-card">
            <div className="cv-logo-wrap">
              <img src={logo} alt="Book Registry" className="cv-logo-img" />
            </div>
            <div className="cv-div" />
            <div className="cv-box">
              {isL ? (
                <form onSubmit={handleLogin}>
                  <label className="cv-lbl">Reader's Name</label>
                  <input className="cv-fi" placeholder="Enter your name…"
                    value={lf.u} onChange={e => setLf({ ...lf, u: e.target.value })} required />
                  <label className="cv-lbl">Password</label>
                  <input className="cv-fi" type="password" placeholder="••••••••"
                    value={lf.p} onChange={e => setLf({ ...lf, p: e.target.value })} required />
                  {authErr && <div className="cv-err">{authErr}</div>}
                  <button className="cv-btn" type="submit">Open the Register →</button>
                  <div className="cv-sw">
                    New reader?{" "}
                    <span onClick={() => { setAuthErr(""); setScreen("signup"); }}>Register here</span>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignup}>
                  <label className="cv-lbl">Choose a Name</label>
                  <input className="cv-fi" placeholder="Your name…"
                    value={sf.u} onChange={e => setSf({ ...sf, u: e.target.value })} required />
                  <label className="cv-lbl">Password</label>
                  <input className="cv-fi" type="password" placeholder="••••••••"
                    value={sf.p} onChange={e => setSf({ ...sf, p: e.target.value })} required />
                  <label className="cv-lbl">Confirm Password</label>
                  <input className="cv-fi" type="password" placeholder="••••••••"
                    value={sf.c} onChange={e => setSf({ ...sf, c: e.target.value })} required />
                  {authErr && <div className="cv-err">{authErr}</div>}
                  <button className="cv-btn" type="submit">Inscribe My Name</button>
                  <div className="cv-sw">
                    Already inscribed?{" "}
                    <span onClick={() => { setAuthErr(""); setScreen("login"); }}>Sign in</span>
                  </div>
                </form>
              )}
            </div>
            <div className="cv-div" style={{ marginTop: 16 }} />
            <div className="cv-footnote">Est. MDCCCXCII · All Rights Reserved</div>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // ═══════════════════════════════════
  // REGISTRY (Main App)
  // ═══════════════════════════════════
  return (
    <div className="rb-root">

      {/* ── Book Spine ── */}
      <div className="rb-spine">
        <div className="rb-spine-orn">❦</div>
        <div className="rb-spine-txt">Bibliotheca Registrum Librorum</div>
        <div className="rb-spine-orn">✦</div>
        <div className="rb-spine-yr">MDCCCXCII</div>
      </div>

      {/* ── Page ── */}
      <div className="rb-page">

        {/* Header */}
        <div className="rh">
          <div className="rh-left">
            <div className="rh-logo-wrap">
              <img src={logo} alt="Book Registry" className="rh-logo-img" />
            </div>
            <div className="rh-status">● Connected to server</div>
          </div>
          <div className="rh-center">
            <div className="rh-stamp">
              <span>OFFICIAL</span>
              <span>RECORD</span>
            </div>
          </div>
          <div className="rh-right">
            <div className="rh-meta">
              <div>{new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })}</div>
              <div>Custodian: {who}</div>
              <div>Volumes: {books.length}</div>
            </div>
            <button className="rh-logout" onClick={() => { setScreen("login"); setWho(""); setWhoId(null); }}>
              ⇐ Close Register
            </button>
          </div>
        </div>

        {/* Entry Form */}
        <div className="rf">
          <div className="rf-lbl">
            {editId ? `Amend Entry №${editId}` : "Inscribe New Volume"}
          </div>
          <form className="rf-grid" onSubmit={handleSubmit}>
            <div className="rf-field">
              <label className="rf-fl">Title</label>
              <input className="rf-in" placeholder="Book title…"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="rf-field">
              <label className="rf-fl">Author</label>
              <input className="rf-in" placeholder="Author name…"
                value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} required />
            </div>
            <div className="rf-field">
              <label className="rf-fl">ISBN</label>
              <input className="rf-in" placeholder="978-…"
                value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })} />
            </div>
            <div className="rf-field">
              <label className="rf-fl">First Released</label>
              <input className="rf-in" type="date"
                value={form.firstRelease} onChange={e => setForm({ ...form, firstRelease: e.target.value })} />
            </div>
            <div className="rf-field">
              <label className="rf-fl">Latest Edition</label>
              <input className="rf-in" type="date"
                value={form.latestRelease} onChange={e => setForm({ ...form, latestRelease: e.target.value })} />
            </div>
            <button className="rf-save" type="submit">
              {editId ? "✎ Amend" : "+ Inscribe"}
            </button>
            {editId && (
              <button className="rf-cancel" type="button"
                onClick={() => { setEditId(null); setForm({ title:"", author:"", isbn:"", firstRelease:"", latestRelease:"" }); }}>
                ✕ Cancel
              </button>
            )}
          </form>
        </div>

        {/* Controls */}
        <div className="rc">
          <div className="rc-sw">
            <span className="rc-si">⌕</span>
            <input className="rc-s" placeholder="Search title, author, ISBN…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="rc-count">
            {sorted.length === 0
              ? "No entries found"
              : `Entries ${Math.min((page - 1) * ROWS + 1, sorted.length)}–${Math.min(page * ROWS, sorted.length)} of ${sorted.length}`}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--ink3)", fontStyle: "italic" }}>
            Loading volumes…
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className={`rt-wrap${anim ? " " + anim : ""}`}>
            <table className="rt">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("id")} style={{ width: 38 }}>
                    №<span className="sa">{arrow("id")}</span>
                  </th>
                  <th onClick={() => toggleSort("title")}>
                    Title<span className="sa">{arrow("title")}</span>
                  </th>
                  <th onClick={() => toggleSort("author")}>
                    Author<span className="sa">{arrow("author")}</span>
                  </th>
                  <th onClick={() => toggleSort("isbn")}>
                    ISBN<span className="sa">{arrow("isbn")}</span>
                  </th>
                  <th onClick={() => toggleSort("firstRelease")}>
                    First Published<span className="sa">{arrow("firstRelease")}</span>
                  </th>
                  <th onClick={() => toggleSort("latestRelease")}>
                    Latest Edition<span className="sa">{arrow("latestRelease")}</span>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign:"center", padding:"28px", fontStyle:"italic", color:"var(--ink3)" }}>
                      — No entries match —
                    </td>
                  </tr>
                ) : pageRows.map((b, i) => (
                  <tr key={b.id} className={editId === b.id ? "ised" : ""} onClick={flipRow} style={{ cursor: "pointer" }}>
                    <td className="cn">{(page - 1) * ROWS + i + 1}</td>
                    <td className="ct">{b.title}</td>
                    <td>{b.author}</td>
                    <td className="ci">{b.isbn || "—"}</td>
                    <td className="cd">{fmt(b.firstRelease)}</td>
                    <td className="cd">{fmt(b.latestRelease)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="ab ae" onClick={e => { e.stopPropagation(); startEdit(b); }}>✎ Edit</button>
                      <button className="ab ad" onClick={e => { e.stopPropagation(); setConfirm(b); }}>✕ Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="rpg">
          <div className="rpg-grp">
            <button className="pg" onClick={() => goPage(1)}      disabled={page === 1}>«</button>
            <button className="pg" onClick={() => goPage(page-1)} disabled={page === 1}>‹</button>
            {pgNums.map(n => (
              <button key={n} className={`pg${n === page ? " cur" : ""}`} onClick={() => goPage(n)}>{n}</button>
            ))}
            <button className="pg" onClick={() => goPage(page+1)} disabled={page === total}>›</button>
            <button className="pg" onClick={() => goPage(total)}  disabled={page === total}>»</button>
          </div>
          <div className="rpg-seal">❦</div>
          <div className="rpg-info">— Folio {page} of {total} · {ROWS} entries per folio —</div>
        </div>

      </div>{/* rb-page */}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Confirm delete */}
      {confirm && (
        <div className="cfg" onClick={() => setConfirm(null)}>
          <div className="cfb" onClick={e => e.stopPropagation()}>
            <div className="cfg-t">Strike from Register?</div>
            <div className="cfg-b">
              You are about to permanently remove:<br />
              <strong>"{confirm.title}"</strong> by {confirm.author}<br /><br />
              This entry shall be struck from the official catalogue. This cannot be undone.
            </div>
            <div className="cfg-a">
              <button className="cfg-n" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="cfg-y" onClick={doDelete}>Strike Entry</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}