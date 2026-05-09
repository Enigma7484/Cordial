# Deploy Midline

Recommended MVP deployment:

- Frontend: Vercel
- Backend: Back4App Containers
- Database: MongoDB Atlas

This gives the frontend the best free static hosting experience while avoiding credit-card-gated backend hosts. Back4App Containers has a no-credit-card free tier for Dockerized apps. It is still not a production SLA, but it is a better fit for demos when a payment method is off the table.

## Required Secrets

Create a MongoDB Atlas cluster, then use its connection string:

```bash
MONGODB_URI=mongodb+srv://...
```

Also create a strong JWT secret:

```bash
JWT_SECRET=<long-random-string>
```

## Backend on Back4App Containers

Create a Back4App Containers app from the GitHub repo:

```bash
Repository: Enigma7484/Cordial
Branch: main
Root directory: midline/backend
Dockerfile: Dockerfile
Plan: Free
```

Set environment variables:

```bash
APP_NAME=Midline API
ENV=production
MONGODB_URI=mongodb+srv://...
MONGODB_DB=midline
JWT_SECRET=<long-random-string>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
FRONTEND_ORIGINS=https://<your-vercel-domain>
SHOW_DEV_OTP=true
OTP_REQUEST_LIMIT=5
OTP_VERIFY_LIMIT=10
OTP_RATE_WINDOW_MINUTES=15
```

Back4App provides `PORT` automatically. The backend Dockerfile uses it.

`SHOW_DEV_OTP=true` is intentional for the MVP demo because no email provider is wired yet. Turn it off only after adding real transactional email.
The OTP limit variables keep demo auth from being hammered by repeated requests or brute-force attempts.

After deploy, verify:

```bash
https://<your-back4app-domain>/health
```

## Frontend on Vercel

Create a Vercel project from the GitHub repo:

```bash
Repository: Enigma7484/Cordial
Root Directory: midline/frontend
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Set environment variables:

```bash
VITE_API_URL=https://<your-back4app-domain>
```

The frontend includes `vercel.json` for SPA routing.

After Vercel gives you the frontend domain, update Back4App:

```bash
FRONTEND_ORIGINS=https://<your-vercel-domain>
```

Then redeploy the Back4App backend.

## Render Alternative

The repo still includes a Render Blueprint at the repository root: `render.yaml`.

## Render Deployment

1. Push the repo to GitHub.
2. In Render, create a new Blueprint from `Enigma7484/Cordial`.
3. Render will detect `render.yaml`.
4. Enter `MONGODB_URI` when prompted.
5. Deploy both services:
   - `midline-api`
   - `midline-web`

Expected URLs:

```bash
Frontend: https://midline-web.onrender.com
Backend:  https://midline-api.onrender.com
```

If Render assigns different hostnames, update:

- `FRONTEND_ORIGINS` on the backend service
- `VITE_API_URL` on the frontend static site

Then redeploy.
