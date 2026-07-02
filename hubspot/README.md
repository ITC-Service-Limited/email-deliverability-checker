# HubSpot Module Plan

This folder now holds the implementation plan for the HubSpot-facing version of the
deliverability checker.

The product is still built around one core principle:

- `backend/` owns SPF, DKIM, DMARC, MX, and DNS analysis
- `frontend/` is the standalone web app
- `hubspot/` defines how HubSpot will collect input and display results

The HubSpot version should remain a thin presentation layer over the same backend API
used by the standalone app.

## What Lives Here

- [module-workflow.md](./module-workflow.md): end-user journey and module behavior
- [api-contract.md](./api-contract.md): request and response contract for the external API
- future HubSpot module/app files when implementation begins

## Current Product Direction

The HubSpot module is intended for client-facing use, so the self-serve experience should:

- collect only a domain or email address
- show SPF, DMARC, MX, and DNS health directly
- keep DKIM as an advanced/locked card for now
- send users to a contact CTA for deeper deliverability reviews

The core SPF, DKIM, DMARC, and deliverability logic should remain in `backend/` so
accuracy does not depend on HubSpot-specific runtime constraints.
