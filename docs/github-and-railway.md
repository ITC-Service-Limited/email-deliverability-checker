# GitHub and Railway Setup

## Recommended Flow

1. Create a new GitHub repository for `email-deliverability-checker`.
2. Push this project to GitHub.
3. In Railway, create two services from the same repo:
   - `frontend` with root directory `frontend`
   - `backend` with root directory `backend`
4. Add environment variables:
   - frontend: `NEXT_PUBLIC_API_BASE_URL`
   - backend: `ALLOWED_ORIGINS`, `DEFAULT_DKIM_SELECTOR`
5. Deploy the backend first, then point the frontend at that URL.

## Backend Service

- Root directory: `backend`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Frontend Service

- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Start command: `npm run start`

## Notes

- Railway can autodetect both services when configured separately.
- This app is stateless for v1, so no database or Redis is required.
- If later we add slower checks, we can introduce a worker service without changing the public API shape much.
