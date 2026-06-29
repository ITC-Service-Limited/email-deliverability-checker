# Email Deliverability Checker

A new standalone project for live SPF, DKIM, DMARC, and email deliverability diagnostics.

This project is designed to be:

- `GitHub-first`: easy to push, review, and deploy
- `Railway-ready`: frontend and backend can be deployed as separate services
- `HubSpot-ready`: the checking engine lives in the backend API so a future HubSpot app can reuse it without changing the core logic
- `Stateless for v1`: no database required for on-demand checks

## Project Structure

```text
email-deliverability-checker/
  backend/     FastAPI API and checking engine
  frontend/    Next.js web app
  hubspot/     Future HubSpot app notes/placeholders
  docs/        Deployment and architecture notes
```

## MVP Scope

The first version focuses on live checks only:

- SPF record discovery and basic validation
- DKIM selector lookup and key inspection
- DMARC record discovery and parsing
- MX and nameserver lookups
- Actionable findings returned immediately to the UI

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` in `frontend/.env.local`.

## GitHub Then Railway

1. Create a new GitHub repository.
2. Push this `email-deliverability-checker` folder as its own repo, or keep it as a subdirectory in a monorepo.
3. In Railway, create:
   - one service rooted at `frontend/`
   - one service rooted at `backend/`
4. Set the frontend environment variable `NEXT_PUBLIC_API_BASE_URL` to the deployed backend URL.

More detail is in [docs/github-and-railway.md](/C:/Users/MohamedGalal/OneDrive%20-%20ITC%20SERVICE%20LIMITED/Desktop/Development%20Projects/Call-Sentiment-Analysis/Call-Sentiment-Analysis/email-deliverability-checker/docs/github-and-railway.md).
