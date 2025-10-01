// frontend/src/App.jsx
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE; // must be set in Render -> Environment

export default function App() {
  const [message, setMessage] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      const data = await res.json();
      setMsgs(data);
    } catch (e) {
      setError("Failed to load messages");
    }
  };

  const send = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attributes: { source: "ui" } }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.details || res.statusText);
      }
      setMessage("");
      await load();
    } catch (e) {
      setError(`Send failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Pub/Sub Messaging UI</h1>

      {/* Input row */}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <input
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          placeholder="Type a message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={send} disabled={loading}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>

      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

      <h2 style={{ marginTop: 24 }}>Recent Messages</h2>
      <ul>
        {msgs.map((m, i) => (
          <li key={m.messageId ?? i}>
            <code>{m.data}</code> <small>({m.publishTime})</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
