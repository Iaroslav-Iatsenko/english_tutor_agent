import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8001";

function App() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("sessionId") || "");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("chat");
  const [unreadErrors, setUnreadErrors] = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows]);

  const canSend = useMemo(() => message.trim().length > 0 && !loading, [message, loading]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    setLoading(true);
    setError("");

    const outgoing = message.trim();

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: outgoing,
          session_id: sessionId || null,
        }),
      });

      if (!response.ok) {
        const detail = await extractErrorDetail(response);
        throw new Error(detail || `Request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem("sessionId", data.session_id);
      }

      setRows((prev) => [
        ...prev,
        {
          user: outgoing,
          agent: data.response,
          corrected: data.corrected,
          errors: data.errors,
        },
      ]);
      if (data.errors?.length > 0) {
        setUnreadErrors((prev) => prev + data.errors.length);
      }
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function resetSession() {
    if (!sessionId) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        const detail = await extractErrorDetail(response);
        throw new Error(detail || `Reset failed with status ${response.status}`);
      }

      setRows([]);
      setSessionId("");
      setUnreadErrors(0);
      localStorage.removeItem("sessionId");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  const allErrors = rows.flatMap((row) =>
    (row.errors || []).map((err) => ({ ...err, sentence: row.user }))
  );

  function switchToErrors() {
    setTab("errors");
    setUnreadErrors(0);
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>English Tutor Agent</h1>
        <p className="subtitle">Practice naturally. Get instant corrections and brief explanations.</p>

        <div className="tabs">
          <button
            type="button"
            className={`tab-btn${tab === "chat" ? " tab-btn--active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`tab-btn${tab === "errors" ? " tab-btn--active" : ""}`}
            onClick={switchToErrors}
          >
            Errors
            {unreadErrors > 0 ? <span className="tab-badge">{unreadErrors}</span> : null}
          </button>
        </div>

        <div className="messages" style={{ display: tab === "chat" ? "flex" : "none" }}>
          {rows.length === 0 ? <p className="empty">Your conversation will appear here.</p> : null}
          {rows.map((row, index) => (
            <article className="message" key={`${row.user}-${index}`}>
              <p>
                <strong>You:</strong> {highlightErrors(row.user, row.errors)}
              </p>
              <p>
                <strong>Tutor:</strong>
              </p>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{row.agent || ""}</ReactMarkdown>
              </div>
              {row.errors?.length > 0 ? (
                <table className="error-table">
                  <thead>
                    <tr>
                      <th>Error</th>
                      <th>Correction</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.errors.map((err, errIndex) => (
                      <tr key={errIndex}>
                        <td><span className="error-fragment">{err.fragment}</span></td>
                        <td><span className="correction-fragment">{err.correction}</span></td>
                        <td>{err.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        {tab === "errors" ? (
          <div className="errors-pane">
            {allErrors.length === 0 ? (
              <p className="empty">No errors recorded yet.</p>
            ) : (
              <table className="error-table error-table--full">
                <thead>
                  <tr>
                    <th>Sentence</th>
                    <th>Error</th>
                    <th>Correction</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {allErrors.map((err, i) => (
                    <tr key={i}>
                      <td>{highlightErrors(err.sentence, [err])}</td>
                      <td><span className="error-fragment">{err.fragment}</span></td>
                      <td><span className="correction-fragment">{err.correction}</span></td>
                      <td>{err.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <form onSubmit={sendMessage} className="composer" style={{ display: tab === "chat" ? undefined : "none" }}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Try: Yesterday I goed to market"
            rows={3}
          />

          <div className="actions">
            <button type="submit" disabled={!canSend}>
              {loading ? "Sending..." : "Send"}
            </button>
            <button type="button" onClick={resetSession} disabled={loading} className="ghost">
              New Session
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function highlightErrors(text, errors) {
  if (!errors?.length) return text;
  const parts = [];
  let remaining = text;
  let keyIndex = 0;
  for (const err of errors) {
    const idx = remaining.indexOf(err.fragment);
    if (idx === -1) continue;
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push(
      <span key={keyIndex++} className="error-fragment">
        {err.fragment}
      </span>
    );
    remaining = remaining.slice(idx + err.fragment.length);
  }
  if (remaining) parts.push(remaining);
  return parts.length ? parts : text;
}

async function extractErrorDetail(response) {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") {
      return payload.detail;
    }
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

export default App;
