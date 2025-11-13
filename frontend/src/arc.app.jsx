// frontend/src/arc.app.jsx
import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [view, setView] = useState("send"); // "send" | "receive"
  const brandBlue = "#003366";
  const brandGold = "#FFC72C";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <header
        style={{
          background: brandBlue,
          color: "#fff",
          padding: "16px 24px",
          marginBottom: 16,
          borderBottom: `4px solid ${brandGold}`,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Group 5 Messaging Provider</h1>
        <p style={{ margin: 0, fontSize: 12 }}>Publisher and Consumer pages</p>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 48px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setView("send")}
            style={{
              padding: "8px 16px",
              background: view === "send" ? brandBlue : "#e2e8f0",
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
              background: view === "receive" ? brandBlue : "#e2e8f0",
              color: view === "receive" ? "#fff" : "#000",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Receiver
          </button>
        </div>

        {view === "send" ? (
          <SenderPage brandBlue={brandBlue} brandGold={brandGold} />
        ) : (
          <ReceiverPage brandBlue={brandBlue} brandGold={brandGold} />
        )}
      </div>
    </div>
  );
}

function SenderPage({ brandBlue, brandGold }) {
  const [message, setMessage] = useState("");
  const [messageId, setMessageId] = useState("");
  const [source, setSource] = useState("ui");
  const [sendDuplicate, setSendDuplicate] = useState(false);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const send = async () => {
    if (!message.trim()) {
      setFeedback("Message cannot be empty.");
      return;
    }

    setLoading(true);
    setFeedback("");

    const baseAttributes = {
      source: source || "ui",
      ...(messageId.trim() ? { messageId: messageId.trim() } : {}),
    };

    const publishOnce = async (attributes) => {
      const body = {
        message,
        attributes,
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(`${API_BASE}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Publish failed: ${errText}`);
        }

        const data = await res.json().catch(() => ({}));
        return data;
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    try {
      const data1 = await publishOnce(baseAttributes);

      let data2 = null;
      if (sendDuplicate) {
        data2 = await publishOnce(baseAttributes);
      }

      const idPart = data1?.messageId || messageId.trim() || "";
      const dupPart = sendDuplicate ? " Duplicate copy sent for detection." : "";

      setFeedback(
        `Published${idPart ? ` (id: ${idPart})` : ""}${
          data1?.profanity_masked ? " [masked]" : ""
        }${dupPart}`
      );

      setMessage("");
      setMessageId("");
    } catch (e) {
      setFeedback(
        e?.name === "AbortError"
          ? "Publish timed out. Please try again."
          : e?.message || "Network error while publishing."
      );
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
      <h2
        style={{
          marginTop: 0,
          color: brandBlue,
          borderBottom: `2px solid ${brandGold}`,
          paddingBottom: 4,
        }}
      >
        Sender page
      </h2>
      <p style={{ color: "#475569", fontSize: 14 }}>
        This page is for publishing messages to the Pub/Sub topic through the backend.
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
        placeholder="Type a message."
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
            placeholder="e.g. Msg-001"
          />
        </div>

        <div style={{ flex: 1 }}>
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

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={sendDuplicate}
          onChange={(e) => setSendDuplicate(e.target.checked)}
        />
      </label>

      <button
        onClick={send}
        disabled={loading}
        style={{
          background: brandBlue,
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
        <p style={{ marginTop: 12, fontSize: 13, color: "#0f172a" }}>{feedback}</p>
      ) : null}
    </div>
  );
}

function ReceiverPage({ brandBlue, brandGold }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  const [autoRefresh, setAutoRefresh] = useState(true);

  const [filterMessageId, setFilterMessageId] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterDuplicate, setFilterDuplicate] = useState("");

  const lightGray = "#F3F4F6";

  function buildQuery() {
    const params = new URLSearchParams();
    if (filterMessageId.trim()) params.append("messageId", filterMessageId.trim());
    if (filterSource.trim()) params.append("source", filterSource.trim());
    if (filterStart.trim()) params.append("start", filterStart.trim());
    if (filterEnd.trim()) params.append("end", filterEnd.trim());
    if (filterDuplicate) params.append("is_duplicate", filterDuplicate);
    params.append("page", page);
    params.append("limit", pageSize);
    return `?${params.toString()}`;
  }

  async function load() {
    setLoading(true);
    try {
      const qs = buildQuery();
      const res = await fetch(`${API_BASE}/api/messages${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let items = [];
      if (data && Array.isArray(data.items)) {
        items = data.items;
        setTotal(data.total ?? data.items.length ?? 0);
      } else if (data && Array.isArray(data.data)) {
        items = data.data;
        setTotal(data.total ?? data.data.length ?? 0);
      } else if (Array.isArray(data)) {
        items = data;
        setTotal(data.length ?? 0);
      } else {
        setTotal(0);
      }

      setMessages(items);
    } catch {
      setMessages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (autoRefresh) {
      const id = setInterval(load, 10000);
      return () => clearInterval(id);
    }
  }, [page, autoRefresh]); // eslint-disable-line

  function clearFilters() {
    setFilterMessageId("");
    setFilterSource("");
    setFilterStart("");
    setFilterEnd("");
    setFilterDuplicate("");
    setPage(1);
    load();
  }

  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          color: brandBlue,
          borderBottom: `2px solid ${brandGold}`,
          paddingBottom: 4,
        }}
      >
        Receiver page
      </h2>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 8 }}>
        View messages stored in the database. Use filters to search by attributes.
      </p>

      {/* subtle "refreshing" indicator */}
      {loading && (
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 0, marginBottom: 8 }}>
          Refreshing messages...
        </p>
      )}

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
            placeholder=""
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
            <option value="">T/F</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button
          onClick={() => {
            setPage(1);
            load();
          }}
          style={{
            background: brandBlue,
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
          onClick={clearFilters}
          style={{
            background: "#e2e8f0",
            border: "none",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Clear Search
        </button>
        <label style={{ marginLeft: "auto", fontSize: 13, color: brandBlue }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Auto refresh
        </label>
      </div>

      {/* Messages table - no more flashing between "Loading" and table */}
      {messages.length === 0 ? (
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
              <tr style={{ background: brandBlue, color: "#fff" }}>
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
                    key={m.messageId || m.id || idx}
                    style={{ background: idx % 2 === 0 ? "#fff" : lightGray }}
                  >
                    <td style={tdStyle}>{m.messageId || m.id || "N/A"}</td>
                    <td style={{ ...tdStyle, maxWidth: 260, wordBreak: "break-word" }}>
                      {m.data || m.message || m.text || ""}
                    </td>
                    <td style={tdStyle}>
                      {(m.attributes && (m.attributes.source || m.attributes.Source)) ||
                        m.source ||
                        ""}
                    </td>
                    <td style={tdStyle}>{m.publishTime || m.created_at || ""}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: isDup ? 700 : 400,
                        color: isDup ? "#b91c1c" : brandBlue,
                      }}
                    >
                      {isDup ? "True" : "False"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 16,
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            style={{
              background: brandBlue,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              opacity: page === 1 ? 0.4 : 1,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 13 }}>
            Page {page} of {Math.ceil(total / pageSize) || 1}
          </span>
          <button
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
            style={{
              background: brandBlue,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              opacity: page >= Math.ceil(total / pageSize) ? 0.4 : 1,
            }}
          >
            Next
          </button>
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

