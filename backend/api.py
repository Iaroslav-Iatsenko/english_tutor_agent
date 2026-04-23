from __future__ import annotations

import json
from threading import Lock
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from graph import build_graph


load_dotenv()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="English Tutor Agent API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph = build_graph()
_sessions: dict[str, dict[str, Any]] = {}
_sessions_lock = Lock()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None


class ChatResponse(BaseModel):
    session_id: str
    response: str
    corrected: str
    errors: list[dict]
    history: list[dict[str, Any]]


class ResetRequest(BaseModel):
    session_id: str


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "English Tutor Agent API is running.",
        "health": "/health",
        "docs": "/docs",
        "chat": "/chat",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat(request: Request, payload: ChatRequest) -> ChatResponse:
    session_id = payload.session_id or str(uuid4())

    with _sessions_lock:
        is_new = session_id not in _sessions
        state = _sessions.get(session_id, {"history": []}).copy()

    if is_new:
        print(json.dumps({"event": "new_session", "session_id": session_id}), flush=True)

    state["user_input"] = payload.message
    result = _graph.invoke(state)

    with _sessions_lock:
        _sessions[session_id] = result

    return ChatResponse(
        session_id=session_id,
        response=result.get("response", ""),
        corrected=result.get("corrected", ""),
        errors=result.get("errors", []),
        history=result.get("history", []),
    )


@app.get("/history/{session_id}")
def get_history(session_id: str) -> dict[str, Any]:
    with _sessions_lock:
        state = _sessions.get(session_id, {"history": []})

    return {"session_id": session_id, "history": state.get("history", [])}


@app.post("/reset")
@limiter.limit("10/minute")
def reset(request: Request, payload: ResetRequest) -> dict[str, str]:
    with _sessions_lock:
        _sessions.pop(payload.session_id, None)

    return {"status": "cleared", "session_id": payload.session_id}
