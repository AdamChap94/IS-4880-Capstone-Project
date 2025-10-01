import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function App() {
  const [message, setMessage] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch(`${API_BASE}/messages`);
    const data = await res.json();
    setMsgs(data);
  };

  const send = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attributes: { source: "ui" } }),
      });
      setMessage("");
      await load();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Pub/Sub Messaging UI</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          placeholder="Type a message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={send} disabled={loading}>Send</button>
      </div>
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
