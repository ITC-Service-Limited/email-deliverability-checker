# Future HubSpot App

This folder is intentionally lightweight for v1.

The product is being built as:

- a standalone web app
- an API-first checking engine
- a future HubSpot-compatible integration

When we add the HubSpot app, this folder can hold:

- app manifest/config
- UI extension code
- HubSpot app pages or cards
- thin integration logic that calls the backend API

The core SPF, DKIM, DMARC, and deliverability logic should remain in `backend/` so accuracy does not depend on HubSpot-specific runtime constraints.
