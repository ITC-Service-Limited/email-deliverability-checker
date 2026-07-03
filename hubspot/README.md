# HubSpot Module Scaffold

This folder now includes the first implementation scaffold for the client-facing HubSpot
module:

- `modules/email-deliverability-checker.module/meta.json`
- `modules/email-deliverability-checker.module/fields.json`
- `modules/email-deliverability-checker.module/module.html`
- `modules/email-deliverability-checker.module/module.css`
- `modules/email-deliverability-checker.module/module.js`

## Expected Setup In HubSpot

1. Upload the module through the HubSpot CLI or Design Manager.
2. Add the module to a page.
3. Set these module fields:
   - `portal_id`
   - `form_id`
   - `domain_field_name` as the internal name of your domain field
   - `email_field_name` as fallback if you want the module to extract a domain from email
   - `api_base_url` pointing at the Railway backend
   - `contact_url` for the DKIM CTA
4. Create or select a HubSpot form that includes at least one of:
   - a domain field
   - an email field

## Current Behavior

- the HubSpot form loads first
- once the form is submitted, the module extracts the domain
- the module calls `POST /api/v1/checks/domain`
- SPF, DMARC, MX, nameservers, and filtered findings render inline
- DKIM remains locked behind a `Contact us` CTA

## Notes

- the module reuses the same external backend as the standalone Railway app
- no DNS logic is handled inside HubSpot itself
- the module currently assumes the backend already permits requests from the HubSpot page origin
