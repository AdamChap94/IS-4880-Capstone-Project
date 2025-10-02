import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function App() {
  const [message, setMessage] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      const data = await res.json();
      setMsgs(Array.isArray(data) ? data : []);
    } catch {
      // keep prior msgs, but show a soft error
      setError("Failed to load messages");
    }
  };

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, attributes: { source: "ui" } }),
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

  useEffect(() => {
    load();
    const id = setInterval(load, 3000); // auto-refresh
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Pub/Sub Messaging UI</h1>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <input
          style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          placeholder="Type a message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={loading}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>

      {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}

      <h2 style={{ marginTop: 24 }}>Recent Messages</h2>

      {msgs.length === 0 ? (
        <div style={{ color: "#666", marginTop: 8 }}>
          No messages yet — send one above or publish via gcloud to see output here.
        </div>
      ) : (
        <ul style={{ marginTop: 12 }}>
          {msgs.map((m, i) => (
            <li key={m.messageId ?? i} style={{ marginBottom: 6 }}>
              <code>{m.data}</code>{" "}
              <small style={{ color: "#555" }}>{m.publishTime}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

