import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE; // set on Render

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


import { useState } from "react";
import MessageComposer from "./MessageComposer.jsx";
import MessageRow from "./MessageRow.jsx";

export default function App() {
  const [messages, setMessages] = useState([]);

  return (
    <div className="container">
      <h1>Group 5 Pub/Sub</h1>

      <MessageComposer
        onMessage={(m) => setMessages((prev) => [m, ...prev])}
      />

      <div className="list">
        {messages.map((m, i) => (
          <MessageRow key={i} text={m.text} flagged={m.flagged} />
        ))}
      </div>

      <style>{`
        .container{max-width:720px;margin:0 auto;padding:1rem}
        h1{font-size:1.25rem;margin:0 0 .75rem}
        .list{margin-top:1rem}
      `}</style>
    </div>
  );
}


import { useEffect, useState } from "react";
import MessageComposer from "./MessageComposer.jsx";
import MessageRow from "./MessageRow.jsx";

const API = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [page] = useState(1);
  const limit = 10;

  async function loadMessages() {
    try {
      const res = await fetch(`${API}/api/messages?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMessages(json.items || []);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  function handleNewMessage(msg) {
    // prepend for real-time feel
    setMessages((prev) => [msg, ...prev]);
  }

  return (
    <div>
      <MessageComposer onMessage={handleNewMessage} />

      <ul>
        {messages.map((m, i) => (
          <MessageRow key={i} message={m} />
        ))}
      </ul>
    </div>
  );
}




