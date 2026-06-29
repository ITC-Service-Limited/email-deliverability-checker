from __future__ import annotations

import base64
import re

import dns.exception
import dns.resolver

from app.models import DkimResult, DmarcResult, DnsRecordSet, Finding, SpfResult

SPF_MECHANISM_RE = re.compile(r"^(?P<qualifier>[+?~-]?)(?P<name>all|include|a|mx|ptr|ip4|ip6|exists|redirect)(?:(?P<sep>[:=])(?P<value>.+))?$")
VALID_DMARC_POLICIES = {"none", "quarantine", "reject"}
VALID_DMARC_ALIGNMENT = {"r", "s"}


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
    if not spf_record:
        return SpfResult(host=domain)
    parsed_spf = _parse_spf_record(spf_record)
    return SpfResult(host=domain, record=spf_record, **parsed_spf)


def get_dmarc(domain: str) -> DmarcResult:
    host = f"_dmarc.{domain}"
    txt_records = _lookup(host, "TXT")
    dmarc_record = next((record for record in txt_records if record.lower().startswith("v=dmarc1")), None)
    if not dmarc_record:
        return DmarcResult(host=host)
    parsed_dmarc = _parse_dmarc_record(dmarc_record)
    return DmarcResult(host=host, record=dmarc_record, **parsed_dmarc)


def get_dkim(domain: str, selector: str) -> DkimResult:
    host = f"{selector}._domainkey.{domain}"
    txt_records = _lookup(host, "TXT")
    dkim_record = next((record for record in txt_records if "v=DKIM1" in record or "p=" in record), None)
    if not dkim_record:
        return DkimResult(host=host)
    parsed_dkim = _parse_dkim_record(dkim_record)
    return DkimResult(host=host, record=dkim_record, **parsed_dkim)


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
    elif spf.issues:
        for issue in spf.issues:
            findings.append(Finding(severity="warning", code="spf_issue", message=issue))
    else:
        findings.append(Finding(severity="info", code="spf_present", message="An SPF record was found."))

    if not dkim.record:
        findings.append(Finding(severity="warning", code="dkim_missing", message="No DKIM record was found for the selected selector."))
    elif dkim.key_size_bits is not None and dkim.key_size_bits < 1024:
        findings.append(Finding(severity="error", code="dkim_key_weak", message="The DKIM public key appears weaker than 1024 bits."))
    elif not dkim.valid:
        findings.append(Finding(severity="warning", code="dkim_invalid", message="A DKIM record was found, but it is missing recommended tags or appears malformed."))
    else:
        findings.append(Finding(severity="info", code="dkim_present", message="A DKIM record was found for the selected selector."))

    if not dmarc.record:
        findings.append(Finding(severity="error", code="dmarc_missing", message="No DMARC record was found."))
    else:
        policy = dmarc.tags.get("p", "missing")
        findings.append(Finding(severity="info", code="dmarc_present", message=f"A DMARC record was found with policy `{policy}`."))
        if not dmarc.valid:
            findings.append(Finding(severity="warning", code="dmarc_invalid", message="The DMARC record was found, but one or more required tags look invalid."))
        if dmarc.policy == "none":
            findings.append(Finding(severity="warning", code="dmarc_monitor_only", message="The DMARC policy is set to monitor only (`p=none`), so it does not actively quarantine or reject failing mail."))
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
    count = 0
    for token in _spf_tokens(record):
        match = SPF_MECHANISM_RE.match(token)
        if not match:
            continue
        name = match.group("name")
        if name in {"include", "a", "mx", "ptr", "exists", "redirect"}:
            count += 1
    return count


def _spf_tokens(record: str) -> list[str]:
    return [token for token in record.split() if token and not token.lower().startswith("v=spf1")]


def _parse_spf_record(record: str) -> dict[str, object]:
    mechanisms: list[str] = []
    includes: list[str] = []
    redirect: str | None = None
    issues: list[str] = []
    all_qualifier: str | None = None

    for token in _spf_tokens(record):
        mechanisms.append(token)
        match = SPF_MECHANISM_RE.match(token)
        if not match:
            issues.append(f"Unrecognized SPF mechanism or modifier: `{token}`.")
            continue
        name = match.group("name")
        qualifier = match.group("qualifier") or "+"
        value = (match.group("value") or "").strip()

        if name == "include" and value:
            includes.append(value)
        if name == "redirect":
            redirect = value or None
            if qualifier != "+":
                issues.append("The SPF `redirect` modifier should not use a qualifier.")
        if name == "all":
            all_qualifier = qualifier

    lookup_count = _estimate_spf_dns_lookups(record)
    if lookup_count > 10:
        issues.append("This SPF record likely exceeds the RFC lookup limit of 10 DNS-mechanism evaluations.")
    if all_qualifier is None:
        issues.append("The SPF record does not end with an `all` mechanism, so policy intent may be unclear.")
    if redirect and all_qualifier is not None:
        issues.append("Using both `redirect` and an `all` mechanism is unusual and can make SPF behavior harder to reason about.")

    return {
        "lookup_count_estimate": lookup_count,
        "includes": includes,
        "redirect": redirect,
        "all_qualifier": all_qualifier,
        "mechanisms": mechanisms,
        "issues": issues,
        "valid": not any(issue.startswith("Unrecognized") for issue in issues),
    }


def _parse_dmarc_record(record: str) -> dict[str, object]:
    tags = _parse_tag_list(record)
    policy = tags.get("p")
    subdomain_policy = tags.get("sp")
    alignment_dkim = tags.get("adkim", "r")
    alignment_spf = tags.get("aspf", "r")
    pct_raw = tags.get("pct")
    pct = int(pct_raw) if pct_raw and pct_raw.isdigit() else None

    valid = bool(
        policy in VALID_DMARC_POLICIES
        and alignment_dkim in VALID_DMARC_ALIGNMENT
        and alignment_spf in VALID_DMARC_ALIGNMENT
        and (subdomain_policy is None or subdomain_policy in VALID_DMARC_POLICIES)
        and (pct is None or 0 <= pct <= 100)
    )

    return {
        "tags": tags,
        "policy": policy,
        "subdomain_policy": subdomain_policy,
        "alignment_dkim": alignment_dkim,
        "alignment_spf": alignment_spf,
        "pct": pct,
        "aggregate_reporting_enabled": "rua" in tags,
        "valid": valid,
    }


def _parse_dkim_record(record: str) -> dict[str, object]:
    tags = _parse_tag_list(record.replace(" ", ""))
    key_size = _estimate_dkim_key_size(record)
    key_type = tags.get("k", "rsa")
    hash_algorithms = [item.strip() for item in tags.get("h", "").split(":") if item.strip()]
    if not hash_algorithms:
        hash_algorithms = ["sha256", "sha1"]

    valid = bool(tags.get("p")) and (
        tags.get("v", "DKIM1").upper() == "DKIM1"
    )

    return {
        "tags": tags,
        "key_size_bits": key_size,
        "key_type": key_type,
        "hash_algorithms": hash_algorithms,
        "valid": valid,
    }


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
