// frontend/src/arc.app.jsx
import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [view, setView] = useState("send"); 
  const brandBlue = "#003366";
  const brandGold = "#FFC72C";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom right, #ffffff, #eef2f7)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Global styles for animations and hover effects */}
      <style>{`
        .fade-in {
          animation: fadeIn 0.25s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .table-row:hover {
          background-color: #e8eef7 !important;
        }

        .btn-hover {
          transition: transform 0.1s ease, box-shadow 0.2s ease;
        }
        .btn-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
      `}</style>

      <header
        style={{
          background: brandBlue,
          color: "#fff",
          padding: "16px 24px",
          borderBottom: `4px solid ${brandGold}`,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Group 5 Messaging Provider</h1>
        <p style={{ margin: 0, fontSize: 12 }}>Publisher and Consumer pages</p>
      </header>

      <div
        style={{
          maxWidth: 900,
          margin: "24px auto 32px",
          padding: "0 16px",
          width: "100%",
          flex: 1,
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setView("send")}
            className="btn-hover"
            style={{
              padding: "8px 16px",
              background: view === "send" ? brandBlue : "#e2e8f0",
              color: view === "send" ? "#fff" : "#000",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Sender
          </button>
          <button
            onClick={() => setView("receive")}
            className="btn-hover"
            style={{
              padding: "8px 16px",
              background: view === "receive" ? brandBlue : "#e2e8f0",
              color: view === "receive" ? "#fff" : "#000",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Receiver
          </button>
        </div>

        {view === "send" ? (
          <SenderPage
            brandBlue={brandBlue}
            brandGold={brandGold}
          />
        ) : (
          <ReceiverPage
            brandBlue={brandBlue}
            brandGold={brandGold}
          />
        )}
      </div>

      <footer
        style={{
          background: brandBlue,
          color: "#fff",
          textAlign: "center",
          padding: "10px 0",
          borderTop: `4px solid ${brandGold}`,
          fontSize: 12,
        }}
      >
        Group 5 Messaging Provider © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function SenderPage({ brandBlue, brandGold }) {
  const [message, setMessage] = useState("");
  const [messageId, setMessageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const send = async () => {
    if (!message.trim()) {
      setFeedback("Message cannot be empty.");
      return;
    }

    setLoading(true);
    setFeedback("");

    const attributes = {
      source: "ui",
      ...(messageId.trim() ? { messageId: messageId.trim() } : {}),
    };

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
        const errText = await res.text().catch(() => "");
        throw new Error(`Publish failed: ${errText || res.status}`);
      }

      const data = await res.json().catch(() => ({}));

      setFeedback(
        `Published${data?.messageId ? ` (id: ${data.messageId})` : ""}${
          data?.profanity_masked ? " [masked]" : ""
        }`
      );
      setMessage("");
      setMessageId("");
    } catch (e) {
      clearTimeout(timer);
      setFeedback(
        e?.name === "AbortError"
          ? "Publish timed out. Please try again."
          : "Network error while publishing."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fade-in"
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
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
      <p style={{ color: "#475569", fontSize: 14, marginTop: 8 }}>
        This page is for publishing messages to the Pub/Sub topic through the backend.
      </p>

      <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
        Message
      </label>
      <textarea
        style={{
          width: "100%",
          height: 120,
          padding: 8,
          borderRadius: 8,
          border: "1px solid #cbd5f5",
          marginBottom: 12,
          resize: "none",
          overflowY: "auto",
          boxSizing: "border-box",
          fontSize: 14,
        }}
        placeholder="Type a message."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Message ID (optional)
          </label>
          <input
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #cbd5f5",
              fontSize: 14,
            }}
            value={messageId}
            onChange={(e) => setMessageId(e.target.value)}
            placeholder="e.g. Msg-001"
          />
        </div>
      </div>

      <button
        onClick={send}
        disabled={loading}
        className="btn-hover"
        style={{
          background: brandBlue,
          color: "#fff",
          border: "none",
          padding: "8px 18px",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 14,
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

function formatPublishTime(value) {
  if (!value) return "";
  if (typeof value === "string" && value.includes("T")) {
    const [datePart, timePartRaw] = value.split("T");
    if (!timePartRaw) return value;
    const noZ = timePartRaw.replace("Z", "");
    const hhmm = noZ.slice(0, 5); 
    return `${datePart} ${hhmm}`;
  }
  return value;
}

function ReceiverPage({ brandBlue, brandGold }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);

  // filters
  const [filterMessageId, setFilterMessageId] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterPublishAt, setFilterPublishAt] = useState(""); 
  const [filterDuplicate, setFilterDuplicate] = useState("");
  const [filterText, setFilterText] = useState(""); 

  const lightGray = "#F3F4F6";

  function buildQuery() {
    const params = new URLSearchParams();
    if (filterMessageId.trim()) params.append("messageId", filterMessageId.trim());
    if (filterSource.trim()) params.append("source", filterSource.trim());
    if (filterPublishAt.trim())
      params.append("publish_datetime", filterPublishAt.trim());
    if (filterDuplicate) params.append("is_duplicate", filterDuplicate);
    if (filterText.trim()) params.append("text", filterText.trim());
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
  }, [page, autoRefresh]); 

  function clearFilters() {
    setFilterMessageId("");
    setFilterSource("");
    setFilterPublishAt("");
    setFilterDuplicate("");
    setFilterText("");
    setPage(1);
    load();
  }

  return (
    <div
      className="fade-in"
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
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

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Message ID
          </label>
          <input
            value={filterMessageId}
            onChange={(e) => setFilterMessageId(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 8,
              border: "1px solid #cbd5f5",
              fontSize: 13,
            }}
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
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 8,
              border: "1px solid #cbd5f5",
              fontSize: 13,
            }}
            placeholder="ui"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Message text
          </label>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 8,
              border: "1px solid #cbd5f5",
              fontSize: 13,
            }}
            placeholder="Full or partial text…"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Publish date and time
          </label>
          <input
            type="datetime-local"
            value={filterPublishAt}
            onChange={(e) => setFilterPublishAt(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 8,
              border: "1px solid #cbd5f5",
              fontSize: 13,
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Is duplicate
          </label>
          <select
            value={filterDuplicate}
            onChange={(e) => setFilterDuplicate(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 8,
              border: "1px solid #cbd5f5",
              fontSize: 13,
            }}
          >
            <option value="">T/F</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e5e7eb",
          margin: "4px 0 12px",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button
          onClick={() => {
            setPage(1);
            load();
          }}
          className="btn-hover"
          style={{
            background: brandBlue,
            color: "#fff",
            border: "none",
            padding: "6px 16px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Search
        </button>
        <button
          onClick={clearFilters}
          className="btn-hover"
          style={{
            background: "#e2e8f0",
            border: "none",
            padding: "6px 16px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Clear search
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

                const rawTime = m.publishTime || m.created_at || "";

                return (
                  <tr
                    key={m.messageId || m.id || idx}
                    className="table-row"
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
                    <td style={tdStyle}>{formatPublishTime(rawTime)}</td>
                    <td style={tdStyle}>
                      {isDup ? (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#b91c1c",
                            padding: "2px 6px",
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          Duplicate
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#e0f2fe",
                            color: brandBlue,
                            padding: "2px 6px",
                            borderRadius: 6,
                            fontWeight: 500,
                            fontSize: 12,
                          }}
                        >
                          Unique
                        </span>
                      )}
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
            className="btn-hover"
            style={{
              background: brandBlue,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: page === 1 ? "default" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
              fontSize: 13,
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
            className="btn-hover"
            style={{
              background: brandBlue,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: page >= Math.ceil(total / pageSize) ? "default" : "pointer",
              opacity: page >= Math.ceil(total / pageSize) ? 0.4 : 1,
              fontSize: 13,
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




