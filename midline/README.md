# Midline MVP

Midline is a lightweight networking app for students and early-career professionals: less formal than LinkedIn, more intentional than Instagram.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, Motor, MongoDB
- Auth: development email OTP plus JWT
- Database: local MongoDB via Docker Compose

## Setup

From `midline/`:

```bash
docker compose up -d
```

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

Frontend:

```bash
cd frontend
copy .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174`. The frontend is configured to call the backend at:

```bash
VITE_API_URL=http://localhost:8010
```

If you change `frontend/.env`, restart `npm run dev`; Vite only reads env values at startup.

## Development Auth

Use any email address. `POST /auth/request-otp` returns `dev_otp` when `ENV=development`, and the frontend displays that code.
OTP requests and verification attempts are rate limited with MongoDB-backed counters.

## API Surface

- `GET /health`
- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `GET /profile/me`
- `PUT /profile/me`
- `GET /profile/{handle}`
- `GET /connections/mine`
- `POST /connections/connect/{handle}`
- `POST /followups`
- `GET /followups/mine`
- `PATCH /followups/{followup_id}`
- `POST /events`
- `GET /events/mine`
- `POST /events/join/{event_code}`
- `POST /asks`
- `GET /asks`
