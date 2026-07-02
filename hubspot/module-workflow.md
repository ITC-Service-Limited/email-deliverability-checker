# HubSpot Module Workflow

## Purpose

Provide a client-facing deliverability checker inside HubSpot without exposing low-level
technical inputs like DKIM selectors.

## User Flow

1. Visitor lands on a HubSpot page containing the deliverability checker module.
2. Visitor enters a domain or email address.
3. HubSpot form or module JavaScript submits the value to the external backend.
4. Backend runs DNS and authentication checks.
5. Module renders the result cards inline on the page.

## Module Inputs

The first release should collect only:

- `domain_or_email`

The module should extract the domain automatically when an email address is provided.

## Module States

### Idle

- brief explanation
- input field
- submit button

### Loading

- inline loader
- text such as `Running deliverability checks...`

### Success

Render cards for:

- SPF
- DMARC
- MX / DNS basics
- DKIM as a locked or blurred card with CTA

### Error

- friendly failure message
- retry option

## DKIM Experience

The client-facing HubSpot module should not expose selector inputs.

Instead:

- show DKIM as `Advanced check`
- blur or lock the detailed card
- show CTA text such as:
  `Need DKIM validation? Contact ITC for a deeper deliverability review.`
- CTA button: `Contact Us`

## CTA Behavior

The CTA can:

- scroll to a HubSpot contact form
- open a HubSpot modal form
- link to a contact page

## Styling Guidance

- follow ITC brand styles
- full-width dark header with ITC logo
- `Poppins` for body text
- `#1c1c1c` primary dark
- `#E20512` accent
- square corners on cards, buttons, and inputs
