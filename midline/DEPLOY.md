# Deploy Midline

Recommended MVP deployment:

- Frontend: Vercel
- Backend: Koyeb
- Database: MongoDB Atlas

This gives the frontend the best free static hosting experience while avoiding Render's 15-minute backend sleep window. Koyeb's free instance still scales to zero after 1 hour without traffic, so it is not a production SLA, but it is friendlier for demos.

## Required Secrets

Create a MongoDB Atlas cluster, then use its connection string:

```bash
MONGODB_URI=mongodb+srv://...
```

Also create a strong JWT secret:

```bash
JWT_SECRET=<long-random-string>
```

## Backend on Koyeb

Create a Koyeb Web Service from the GitHub repo:

```bash
Repository: Enigma7484/Cordial
Branch: main
Work directory: midline/backend
Builder: Dockerfile
Instance: Free
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
```

Koyeb provides `PORT` automatically. The backend Dockerfile uses it.

After deploy, verify:

```bash
https://<your-koyeb-domain>/health
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
VITE_API_URL=https://<your-koyeb-domain>
```

The frontend includes `vercel.json` for SPA routing.

After Vercel gives you the frontend domain, update Koyeb:

```bash
FRONTEND_ORIGINS=https://<your-vercel-domain>
```

Then redeploy the Koyeb backend.

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
