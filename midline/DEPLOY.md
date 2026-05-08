# Deploy Midline

The repo includes a Render Blueprint at the repository root: `render.yaml`.

## Required Secret

Create a MongoDB Atlas cluster, then use its connection string for:

```bash
MONGODB_URI=mongodb+srv://...
```

Render will prompt for this value because `MONGODB_URI` is marked `sync: false`.

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
