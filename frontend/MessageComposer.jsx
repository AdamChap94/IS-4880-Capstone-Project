import { useState } from "react";

export default function MessageComposer({ onMessage }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;

    setBusy(true);
    setError(null);
    try {
      const API = import.meta.env.VITE_API_BASE || ""; 
      const res = await fetch(`${API}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { data: maskedText, flagged } = await res.json();
      onMessage({ text: maskedText, flagged });
      setText("");
    } catch (err) {
      setError(err.message || "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="composer">
      <input
        className="input"
        placeholder="Type a message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />
      <button className="btn" disabled={busy || !text.trim()}>
        {busy ? "Sending…" : "Send"}
      </button>
      {error && <div className="error">{error}</div>}
      <style>{`
        .composer{display:flex;gap:.5rem}
        .input{flex:1;padding:.5rem;border:1px solid #ddd;border-radius:6px}
        .btn{padding:.5rem .8rem;border:1px solid #ddd;border-radius:6px;background:#fff}
        .error{color:#b00020;font-size:.9rem}
      `}</style>
    </form>
  );
}
