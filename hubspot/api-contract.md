# HubSpot API Contract

## Overview

The HubSpot module should call the same external backend service used by the standalone
frontend.

## Endpoint

`POST /api/v1/checks/domain`

## Request

```json
{
  "domain": "itcservice.co.uk"
}
```

## Input Rules

- If the module collects an email address, extract the domain before sending.
- Do not expose DKIM selector input in the HubSpot module.

## Response Shape

```json
{
  "domain": "itcservice.co.uk",
  "nameservers": {
    "host": "itcservice.co.uk",
    "record_type": "NS",
    "values": ["ns1.example.com.", "ns2.example.com."]
  },
  "mx": {
    "host": "itcservice.co.uk",
    "record_type": "MX",
    "values": ["10 mx1.example.com."]
  },
  "spf": {
    "host": "itcservice.co.uk",
    "record": "v=spf1 include:_spf.example.com -all",
    "lookup_count_estimate": 1,
    "includes": ["_spf.example.com"],
    "redirect": null,
    "all_qualifier": "-",
    "mechanisms": ["include:_spf.example.com", "-all"],
    "issues": [],
    "valid": true
  },
  "dkim": {
    "host": "default._domainkey.itcservice.co.uk",
    "record": null,
    "key_size_bits": null,
    "tags": {},
    "key_type": null,
    "hash_algorithms": [],
    "valid": false
  },
  "dmarc": {
    "host": "_dmarc.itcservice.co.uk",
    "record": "v=DMARC1; p=none; rua=mailto:dmarc@example.com",
    "tags": {
      "v": "DMARC1",
      "p": "none",
      "rua": "mailto:dmarc@example.com"
    },
    "policy": "none",
    "subdomain_policy": null,
    "alignment_dkim": "r",
    "alignment_spf": "r",
    "pct": null,
    "aggregate_reporting_enabled": true,
    "valid": true
  },
  "findings": [
    {
      "severity": "info",
      "code": "spf_present",
      "message": "An SPF record was found."
    }
  ]
}
```

## HubSpot Display Mapping

### Show Directly

- SPF status and issues
- DMARC policy and reporting status
- MX and nameserver values
- findings summary

### Hide or Lock

- DKIM detailed verification

The module can still read the `dkim` object, but the UI should present it as a locked
advanced check for now.

## Future Expansion

When the backend supports automatic DKIM discovery and a live email test flow, this
contract can grow to include:

- discovered DKIM selectors
- live message analysis results
- inbox-path diagnostics
