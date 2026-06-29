# Architecture Notes

## Core Principle

Keep the checking engine separate from presentation layers.

That means:

- `backend/` owns DNS and deliverability logic
- `frontend/` is a standalone customer-facing UI
- `hubspot/` will become a thin integration layer later

## Why This Helps

- better reuse across standalone and HubSpot experiences
- accuracy stays tied to one implementation
- easier testing
- cleaner deployment to Railway

## MVP Checks

- NS lookup
- MX lookup
- SPF discovery and estimated lookup counting
- DKIM selector lookup and estimated key size
- DMARC discovery and tag parsing

## Natural Next Steps

- SPF recursion and full include graph evaluation
- multi-resolver comparison
- SMTP/TLS checks
- inbox placement tests
- DMARC aggregate report ingestion if monitoring is added later
