from __future__ import annotations

import base64
import re
from typing import Iterable

import dns.exception
import dns.resolver

from app.models import DkimResult, DmarcResult, DnsRecordSet, Finding, SpfResult

SPF_MECHANISM_RE = re.compile(r"(?P<name>include|a|mx|ptr|exists|redirect)=?[:]?([^\s]+)?")


def _resolver() -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = 4.0
    resolver.timeout = 4.0
    return resolver


def _lookup(host: str, record_type: str) -> list[str]:
    try:
        answers = _resolver().resolve(host, record_type)
        return [answer.to_text().strip('"') for answer in answers]
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.exception.Timeout):
        return []


def get_nameservers(domain: str) -> DnsRecordSet:
    return DnsRecordSet(host=domain, record_type="NS", values=_lookup(domain, "NS"))


def get_mx(domain: str) -> DnsRecordSet:
    return DnsRecordSet(host=domain, record_type="MX", values=_lookup(domain, "MX"))


def get_spf(domain: str) -> SpfResult:
    txt_records = _lookup(domain, "TXT")
    spf_record = next((record for record in txt_records if record.lower().startswith("v=spf1")), None)
    lookup_count = _estimate_spf_dns_lookups(spf_record) if spf_record else 0
    return SpfResult(host=domain, record=spf_record, lookup_count_estimate=lookup_count)


def get_dmarc(domain: str) -> DmarcResult:
    host = f"_dmarc.{domain}"
    txt_records = _lookup(host, "TXT")
    dmarc_record = next((record for record in txt_records if record.lower().startswith("v=dmarc1")), None)
    tags = _parse_tag_list(dmarc_record) if dmarc_record else {}
    return DmarcResult(host=host, record=dmarc_record, tags=tags)


def get_dkim(domain: str, selector: str) -> DkimResult:
    host = f"{selector}._domainkey.{domain}"
    txt_records = _lookup(host, "TXT")
    dkim_record = next((record for record in txt_records if "v=DKIM1" in record or "p=" in record), None)
    key_size = _estimate_dkim_key_size(dkim_record) if dkim_record else None
    return DkimResult(host=host, record=dkim_record, key_size_bits=key_size)


def build_findings(
    nameservers: DnsRecordSet,
    mx: DnsRecordSet,
    spf: SpfResult,
    dkim: DkimResult,
    dmarc: DmarcResult,
) -> list[Finding]:
    findings: list[Finding] = []

    if not nameservers.values:
        findings.append(Finding(severity="error", code="ns_missing", message="No authoritative nameservers were returned for this domain."))

    if not mx.values:
        findings.append(Finding(severity="warning", code="mx_missing", message="No MX records were found. Some domains can still receive mail via A/AAAA fallback, but this is usually a deliverability risk."))

    if not spf.record:
        findings.append(Finding(severity="error", code="spf_missing", message="No SPF record was found."))
    elif spf.lookup_count_estimate > 10:
        findings.append(Finding(severity="error", code="spf_lookup_limit", message="The SPF record appears to exceed the 10-DNS-lookup evaluation limit."))
    else:
        findings.append(Finding(severity="info", code="spf_present", message="An SPF record was found."))

    if not dkim.record:
        findings.append(Finding(severity="warning", code="dkim_missing", message="No DKIM record was found for the selected selector."))
    elif dkim.key_size_bits is not None and dkim.key_size_bits < 1024:
        findings.append(Finding(severity="error", code="dkim_key_weak", message="The DKIM public key appears weaker than 1024 bits."))
    else:
        findings.append(Finding(severity="info", code="dkim_present", message="A DKIM record was found for the selected selector."))

    if not dmarc.record:
        findings.append(Finding(severity="error", code="dmarc_missing", message="No DMARC record was found."))
    else:
        policy = dmarc.tags.get("p", "missing")
        findings.append(Finding(severity="info", code="dmarc_present", message=f"A DMARC record was found with policy `{policy}`."))
        if "rua" not in dmarc.tags:
            findings.append(Finding(severity="warning", code="dmarc_rua_missing", message="The DMARC record does not include a rua tag for aggregate reporting."))

    return findings


def _parse_tag_list(record: str) -> dict[str, str]:
    tags: dict[str, str] = {}
    for chunk in record.split(";"):
        if "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        tags[key.strip().lower()] = value.strip()
    return tags


def _estimate_spf_dns_lookups(record: str | None) -> int:
    if not record:
        return 0
    return sum(1 for _ in SPF_MECHANISM_RE.finditer(record))


def _estimate_dkim_key_size(record: str) -> int | None:
    tags = _parse_tag_list(record.replace(" ", ""))
    key = tags.get("p")
    if not key:
        return None
    try:
        decoded = base64.b64decode(key + "==", validate=False)
    except (ValueError, base64.binascii.Error):
        return None
    return len(decoded) * 8 if decoded else None
