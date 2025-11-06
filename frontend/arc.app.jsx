import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE; // set on Render

export default function App() {
  const [view, setView] = useState("send"); // "send" or "receive"

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <header
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "16px 24px",
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>
          Cloud Messaging Provider - UI
        </h1>
        <p style={{ margin: 0, fontSize: 12 }}>
          Project 1 - Publisher and Consumer pages
        </p>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 48px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setView("send")}
            style={{
              padding: "8px 16px",
              background: view === "send" ? "#1d4ed8" : "#e2e8f0",
              color: view === "send" ? "#fff" : "#000",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Sender
          </button>
          <button
            onClick={() => setView("receive")}
            style={{
              padding: "8px 16px",
              background: view === "receive" ? "#1d4ed8" : "#e2e8f0",
              color: view === "receive" ? "#fff" : "#000",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Receiver
          </button>
        </div>

        {view === "send" ? <SenderPage /> : <ReceiverPage />}
      </div>
    </div>
  );
}

function SenderPage() {
  const [message, setMessage] = useState("");
  const [messageId, setMessageId] = useState("");
  const [source, setSource] = useState("ui");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const send = async () => {
    if (!message.trim()) {
      setFeedback("Message cannot be empty.");
      return;
    }
    setLoading(true);
    setFeedback("");
    try {
      const body = {
        message,
        attributes: {
          source: source || "ui",
        },
      };
      // If user provided a messageId, send it in attributes since your duplicate logic is likely in backend/DB
      if (messageId.trim()) {
        body.attributes.messageId = messageId.trim();
      }

      const res = await fetch(`${API_BASE}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        setFeedback(`Publish failed: ${errText}`);
      } else {
        setFeedback("Message published.");
        setMessage("");
        // keep messageId if you want to reuse it, or clear it:
        // setMessageId("");
      }
    } catch (err) {
      setFeedback("Network error while publishing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Sender page</h2>
      <p style={{ color: "#475569", fontSize: 14 }}>
        Use this page to publish a message to your Pub/Sub topic through the backend.
      </p>

      <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
        Message
      </label>
      <textarea
        style={{
          width: "100%",
          minHeight: 100,
          padding: 8,
          borderRadius: 6,
          border: "1px solid #cbd5f5",
          marginBottom: 12,
        }}
        placeholder='Type a message. You can paste JSON here like {"name":"test"}'
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Message ID (optional, for duplicate detection)
          </label>
          <input
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #cbd5f5",
            }}
            value={messageId}
            onChange={(e) => setMessageId(e.target.value)}
            placeholder="e.g. msg-001"
          />
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Source
          </label>
          <input
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #cbd5f5",
            }}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="ui"
          />
        </div>
      </div>

      <button
        onClick={send}
        disabled={loading}
        style={{
          background: "#1d4ed8",
          color: "#fff",
          border: "none",
          padding: "8px 16px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {loading ? "Sending..." : "Send message"}
      </button>

      {feedback ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "#0f172a" }}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

function ReceiverPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // filters mentioned in transcript and project doc
  const [filterMessageId, setFilterMessageId] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterDuplicate, setFilterDuplicate] = useState("");

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (filterMessageId.trim()) params.append("messageId", filterMessageId.trim());
    if (filterSource.trim()) params.append("source", filterSource.trim());
    if (filterStart.trim()) params.append("start", filterStart.trim());
    if (filterEnd.trim()) params.append("end", filterEnd.trim());
    if (filterDuplicate) params.append("is_duplicate", filterDuplicate);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const load = async () => {
    setLoading(true);
    try {
      const qs = buildQuery();
      const res = await fetch(`${API_BASE}/messages${qs}`);
      const data = await res.json();
      // Expecting array of messages from backend
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Receiver page</h2>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 16 }}>
        View messages stored in the database. Use filters to search by attributes as Adam requested.
      </p>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Message ID
          </label>
          <input
            value={filterMessageId}
            onChange={(e) => setFilterMessageId(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5f5" }}
            placeholder="msg-001"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Source
          </label>
          <input
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5f5" }}
            placeholder="ui"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Start date/time
          </label>
          <input
            type="datetime-local"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5f5" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            End date/time
          </label>
          <input
            type="datetime-local"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5f5" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Is duplicate
          </label>
          <select
            value={filterDuplicate}
            onChange={(e) => setFilterDuplicate(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5f5" }}
          >
            <option value="">Any</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={load}
          style={{
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Search
        </button>
        <button
          onClick={() => {
            setFilterMessageId("");
            setFilterSource("");
            setFilterStart("");
            setFilterEnd("");
            setFilterDuplicate("");
            // reload all
            setTimeout(() => load(), 0);
          }}
          style={{
            background: "#e2e8f0",
            border: "none",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </div>

      {/* Messages table */}
      {loading ? (
        <p>Loading messages...</p>
      ) : messages.length === 0 ? (
        <p>No messages found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "#e2e8f0" }}>
                <th style={thStyle}>Message ID</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Publish time</th>
                <th style={thStyle}>Is duplicate</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m, idx) => {
                const isDup =
                  m.is_duplicate === true ||
                  m.is_duplicate === "true" ||
                  m.isDuplicate === true;
                return (
                  <tr
                    key={m.messageId || idx}
                    style={{
                      background: idx % 2 === 0 ? "#fff" : "#f8fafc",
                    }}
                  >
                    <td style={tdStyle}>{m.messageId || m.id || "N/A"}</td>
                    <td style={{ ...tdStyle, maxWidth: 260, wordBreak: "break-word" }}>
                      {m.data || m.message || ""}
                    </td>
                    <td style={tdStyle}>
                      {(m.attributes && (m.attributes.source || m.attributes.Source)) ||
                        m.source ||
                        ""}
                    </td>
                    <td style={tdStyle}>{m.publishTime || m.created_at || ""}</td>
                    <td style={{ ...tdStyle, fontWeight: isDup ? 700 : 400, color: isDup ? "#b91c1c" : "#0f172a" }}>
                      {isDup ? "True" : "False"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "1px solid #cbd5f5",
};

const tdStyle = {
  padding: "6px 6px",
  borderBottom: "1px solid #e2e8f0",
};




