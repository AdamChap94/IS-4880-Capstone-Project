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
    setMessages(prev => [msg, ...prev]);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1rem" }}>
      <h1>Group 5 Pub/Sub</h1>
      <MessageComposer onMessage={handleNewMessage} />
      <div style={{ marginTop: "1rem" }}>
        {messages.map((m, i) => (
          <MessageRow key={i} text={m.text} flagged={m.flagged} />
        ))}
      </div>
    </div>
  );
}

