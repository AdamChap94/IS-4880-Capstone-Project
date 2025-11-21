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
        background: "linear-gradient(to bottom right, #f5f7fa, #e2e8f0)",
        display: "flex",
        flexDirection: "column",
        color: "#e5e7eb",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        overflowX: "hidden", // prevent any horizontal spill on mobile
      }}
    >
      <style>{`
        .fade-in {
          animation: fadeIn 0.25s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .table-row:hover {
          background-color: #111827 !important;
        }

        .btn-hover {
          transition: transform 0.1s ease, box-shadow 0.2s ease, background 0.15s ease;
        }
        .btn-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 0 16px rgba(37, 99, 235, 0.4);
        }

        input, select, textarea {
          outline: none;
        }
        input:focus, select:focus, textarea:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.7);
        }
      `}</style>

      <header
        style={{
          background: "rgba(3, 7, 18, 0.9)",
          backdropFilter: "blur(10px)",
          color: "#e5e7eb",
          padding: "14px 24px",
          borderBottom: `3px solid ${brandGold}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Group 5 Messaging Provider</h1>
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
          Pub/Sub based publisher and consumer dashboard
        </p>
      </header>

      {/* Main content */}
      <div
        style={{
          maxWidth: 980,
          margin: "28px auto 36px",
          padding: "0 16px",
          width: "100%",
          flex: 1,
          boxSizing: "border-box",
        }}
      >
        {/* Tabs row */}
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            display: "flex",
            justifyContent: "center",
            marginBottom: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              gap: 8,
              padding: 4,
              borderRadius: 999,
              background: "rgba(15,23,42,0.9)",
              boxShadow: "0 10px 30px rgba(15,23,42,0.7)",
              border: "1px solid rgba(75,85,99,0.7)",
            }}
          >
            <button
              onClick={() => setView("send")}
              className="btn-hover"
              style={{
                padding: "8px 22px",
                background:
                  view === "send"
                    ? brandBlue
                    : "linear-gradient(to right, #020617, #111827)",
                color: view === "send" ? "#f9fafb" : "#9ca3af",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Sender
            </button>
            <button
              onClick={() => setView("receive")}
              className="btn-hover"
              style={{
                padding: "8px 22px",
                background:
                  view === "receive"
                    ? brandBlue
                    : "linear-gradient(to right, #020617, #111827)",
                color: view === "receive" ? "#f9fafb" : "#9ca3af",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Receiver
            </button>
          </div>
        </div>

        {view === "send" ? (
          <SenderPage brandBlue={brandBlue} brandGold={brandGold} />
        ) : (
          <ReceiverPage brandBlue={brandBlue} brandGold={brandGold} />
        )}
      </div>

      <footer
        style={{
          background: "rgba(3, 7, 18, 0.95)",
          color: "#9ca3af",
          textAlign: "center",
          padding: "10px 0",
          borderTop: `3px solid ${brandGold}`,
          fontSize: 11,
          boxShadow: "0 -6px 24px rgba(0,0,0,0.7)",
        }}
      >
        Group 5 Messaging Provider · {new Date().getFullYear()}
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
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(6px)",
        padding: "22px 18px",
        borderRadius: 16,
        boxShadow: "0 18px 40px rgba(0,0,0,0.85)",
        border: "1px solid rgba(0,0,0,0.08)",
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          color: "#1f2937",
          borderBottom: `1px solid rgba(75,85,99,0.3)`,
          paddingBottom: 6,
          fontSize: 17,
        }}
      >
        Sender page
      </h2>
      <p style={{ color: "#4b5563", fontSize: 13, marginTop: 8, marginBottom: 16 }}>
        Publish messages into the Pub/Sub topic through the backend. Use an optional
        Message ID to test duplicate handling.
      </p>

      <label
        style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#111827" }}
      >
        Message
      </label>
      <textarea
        style={{
          width: "100%",
          height: 130,
          padding: 10,
          borderRadius: 10,
          border: "1px solid #cbd5f5",
          marginBottom: 12,
          resize: "none",
          overflowY: "auto",
          boxSizing: "border-box",
          fontSize: 14,
          background: "#ffffff",
          color: "#0f172a",
        }}
        placeholder="Type a message to publish..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label
            style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#111827" }}
          >
            Message ID (optional)
          </label>
          <input
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 10,
              border: "1px solid #cbd5f5",
              fontSize: 13,
              background: "#ffffff",
              color: "#0f172a",
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
          color: "#f9fafb",
          border: "none",
          padding: "8px 20px",
          borderRadius: 999,
          cursor: loading ? "default" : "pointer",
          fontSize: 14,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Sending..." : "Send message"}
      </button>

      {feedback ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "#111827" }}>{feedback}</p>
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

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);

  const [autoRefresh, setAutoRefresh] = useState(true);

  const [filterMessageId, setFilterMessageId] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterPublishAt, setFilterPublishAt] = useState("");
  const [filterDuplicate, setFilterDuplicate] = useState("");
  const [filterText, setFilterText] = useState("");

  const lightRow = "#020617";
  const darkRow = "#020617";

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
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(6px)",
        padding: "22px 18px",
        borderRadius: 16,
        boxShadow: "0 18px 40px rgba(0,0,0,0.85)",
        border: "1px solid rgba(0,0,0,0.08)",
        marginTop: 24,
        width: "100%",
        maxWidth: 900,
        marginLeft: "auto",
        marginRight: "auto",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          color: "#1f2937",
          borderBottom: `1px solid rgba(75,85,99,0.3)`,
          paddingBottom: 6,
          fontSize: 17,
        }}
      >
        Receiver page
      </h2>
      <p style={{ color: "#4b5563", fontSize: 13, marginBottom: 10 }}>
        View messages stored in the database. Use the filters below to locate specific
        messages by ID, source, text, publish timestamp, or duplicate status.
      </p>

      {loading && (
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 0, marginBottom: 8 }}>
          Syncing messages from backend...
        </p>
      )}

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          marginBottom: 10,
          marginTop: 4,
        }}
      >
        <div>
          <label
            style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#111827" }}
          >
            Message ID
          </label>
          <input
            value={filterMessageId}
            onChange={(e) => setFilterMessageId(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 10,
              border: "1px solid #cbd5f5",
              fontSize: 12,
              background: "#ffffff",
              color: "#0f172a",
            }}
            placeholder=""
          />
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#111827" }}
          >
            Source
          </label>
          <input
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 10,
              border: "1px solid #cbd5f5",
              fontSize: 12,
              background: "#ffffff",
              color: "#0f172a",
            }}
            placeholder="ui"
          />
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#111827" }}
          >
            Message text
          </label>
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 10,
              border: "1px solid #cbd5f5",
              fontSize: 12,
              background: "#ffffff",
              color: "#0f172a",
            }}
            placeholder="Full or partial text..."
          />
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#111827" }}
          >
            Publish date and time (24-hour)
          </label>
          <input
            type="datetime-local"
            value={filterPublishAt}
            onChange={(e) => setFilterPublishAt(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 10,
              border: "1px solid #cbd5f5",
              fontSize: 12,
              background: "#ffffff",
              color: "#0f172a",
            }}
          />
        </div>
        <div>
          <label
            style={{ display: "block", fontSize: 12, marginBottom: 4, color: "#111827" }}
          >
            Is duplicate
          </label>
          <select
            value={filterDuplicate}
            onChange={(e) => setFilterDuplicate(e.target.value)}
            style={{
              width: "100%",
              padding: 6,
              borderRadius: 10,
              border: "1px solid #cbd5f5",
              fontSize: 12,
              background: "#ffffff",
              color: "#0f172a",
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
          borderTop: "1px solid rgba(148,163,184,0.8)",
          margin: "6px 0 12px",
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
            color: "#f9fafb",
            border: "none",
            padding: "6px 18px",
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
            background: "linear-gradient(to right, #111827, #020617)",
            border: "1px solid #374151",
            padding: "6px 18px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 13,
            color: "#e5e7eb",
          }}
        >
          Clear search
        </button>
        <label style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
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
        <p style={{ fontSize: 13, color: "#6b7280" }}>No messages found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              background: "#020617",
            }}
          >
            <thead>
              <tr
                style={{
                  background:
                    "linear-gradient(to right, #020617, #111827, #020617)",
                  color: "#e5e7eb",
                }}
              >
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
                    style={{
                      background: idx % 2 === 0 ? lightRow : darkRow,
                    }}
                  >
                    <td style={tdStyle}>{m.messageId || m.id || "N/A"}</td>
                    <td
                      style={{
                        ...tdStyle,
                        maxWidth: 260,
                        wordBreak: "break-word",
                      }}
                    >
                      {m.data || m.message || m.text || ""}
                    </td>
                    <td style={tdStyle}>
                      {(m.attributes &&
                        (m.attributes.source || m.attributes.Source)) ||
                        m.source ||
                        ""}
                    </td>
                    <td style={tdStyle}>{formatPublishTime(rawTime)}</td>
                    <td style={tdStyle}>
                      {isDup ? (
                        <span
                          style={{
                            background: "rgba(248, 113, 113, 0.18)",
                            color: "#fca5a5",
                            padding: "2px 7px",
                            borderRadius: 999,
                            fontSize: 11,
                            border: "1px solid rgba(239,68,68,0.5)",
                          }}
                        >
                          Duplicate
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(56, 189, 248, 0.16)",
                            color: "#7dd3fc",
                            padding: "2px 7px",
                            borderRadius: 999,
                            fontSize: 11,
                            border: "1px solid rgba(56,189,248,0.5)",
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
              color: "#f9fafb",
              border: "none",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: page === 1 ? "default" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
              fontSize: 12,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Page {page} of {Math.ceil(total / pageSize) || 1}
          </span>
          <button
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
            className="btn-hover"
            style={{
              background: brandBlue,
              color: "#f9fafb",
              border: "none",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: page >= Math.ceil(total / pageSize) ? "default" : "pointer",
              opacity: page >= Math.ceil(total / pageSize) ? 0.4 : 1,
              fontSize: 12,
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
  borderBottom: "1px solid #1f2937",
};

const tdStyle = {
  padding: "6px 6px",
  borderBottom: "1px solid #111827",
  color: "#e5e7eb",
};
