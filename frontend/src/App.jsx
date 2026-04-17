import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

function App() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("sessionId") || "");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      localStorage.removeItem("sessionId");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>English Tutor Agent</h1>
        <p className="subtitle">Practice naturally. Get instant corrections and brief explanations.</p>

        <div className="messages">
          {rows.length === 0 ? <p className="empty">Your conversation will appear here.</p> : null}
          {rows.map((row, index) => (
            <article className="message" key={`${row.user}-${index}`}>
              <p>
                <strong>You:</strong> {row.user}
              </p>
              <p>
                <strong>Tutor:</strong>
              </p>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{row.agent || ""}</ReactMarkdown>
              </div>
              {row.errors?.length > 0 ? (
                <>
                  <p>
                    <strong>Correction:</strong> {row.corrected}
                  </p>
                  <ul>
                    {row.errors.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        {error ? <p className="error">{error}</p> : null}

        <form onSubmit={sendMessage} className="composer">
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
