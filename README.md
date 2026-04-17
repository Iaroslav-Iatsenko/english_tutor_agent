# English Tutor Agent (FastAPI + React)

This project has been refactored into:

- A `FastAPI` backend that wraps the existing LangGraph tutoring logic.
- A `React` frontend for browser-based chat practice.

## Project Layout

- `api.py`: FastAPI service (`/chat`, `/history/{session_id}`, `/reset`, `/health`)
- `graph.py`, `nodes.py`, `state.py`, `memory.py`: core tutor logic
- `frontend/`: React app (Vite)

## Backend Setup

1. Activate your virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Ensure your `.env` contains your OpenAI key (for example `OPENAI_API_KEY=...`).
4. Start API server:

```bash
uvicorn api:app --reload --port 8001
```

Backend runs at `http://127.0.0.1:8001`.

## Frontend Setup

From the `frontend/` directory:

```bash
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173` and calls the backend at `http://127.0.0.1:8001` when configured below.

Optional override:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8001 npm run dev
```

## API Endpoints

- `GET /health`: health check
- `POST /chat`
	- Request JSON: `{"message": "your text", "session_id": "optional-id"}`
	- Response JSON includes `session_id`, `response`, `corrected`, `errors`, and `history`
- `GET /history/{session_id}`: returns chat history for a session
- `POST /reset`: clears session state (`{"session_id":"..."}`)
