import app.services.dns_checks as dns_checks
from app.models import BimiResult, BlacklistCheck, BlacklistResult, DkimResult, DmarcResult, DnsRecordSet, SpfResult
from app.services.dns_checks import (
    _extract_mx_hosts,
    _estimate_spf_dns_lookups,
    _parse_dkim_record,
    _parse_dmarc_record,
    _parse_spf_record,
    build_cross_record_validations,
    build_findings,
)


def test_parse_spf_record_extracts_core_details() -> None:
    record = "v=spf1 include:_spf.google.com include:mailgun.org ip4:192.0.2.0/24 ~all"

    parsed = _parse_spf_record(record)

    assert parsed["lookup_count_estimate"] == 2
    assert parsed["includes"] == ["_spf.google.com", "mailgun.org"]
    assert parsed["all_qualifier"] == "~"
    assert parsed["valid"] is True


def test_parse_spf_record_flags_missing_all() -> None:
    parsed = _parse_spf_record("v=spf1 include:_spf.example.com")

    assert any("does not end with an `all` mechanism" in issue for issue in parsed["issues"])


def test_parse_dmarc_record_validates_core_tags() -> None:
    parsed = _parse_dmarc_record(
        "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=s; aspf=r; pct=50"
    )

    assert parsed["policy"] == "quarantine"
    assert parsed["alignment_dkim"] == "s"
    assert parsed["aggregate_reporting_enabled"] is True
    assert parsed["valid"] is True


def test_parse_dmarc_record_rejects_invalid_policy() -> None:
    parsed = _parse_dmarc_record("v=DMARC1; p=maybe")

    assert parsed["valid"] is False


def test_parse_dkim_record_extracts_tags_and_defaults() -> None:
    parsed = _parse_dkim_record("v=DKIM1; k=rsa; p=QUJDREVGRw==")

    assert parsed["key_type"] == "rsa"
    assert parsed["hash_algorithms"] == ["sha256", "sha1"]
    assert parsed["valid"] is True


def test_estimate_spf_dns_lookups_counts_only_lookup_mechanisms() -> None:
    record = "v=spf1 ip4:203.0.113.0/24 include:_spf.example.com a mx -all"

    assert _estimate_spf_dns_lookups(record) == 3


def test_parse_spf_record_expands_nested_include_lookups(monkeypatch) -> None:
    records = {
        "example.com": "v=spf1 a mx include:relay.example.com ~all",
        "relay.example.com": "v=spf1 include:mail.example.net -all",
        "mail.example.net": "v=spf1 ip4:203.0.113.20 -all",
    }

    monkeypatch.setattr(dns_checks, "_find_spf_record", lambda host: records.get(host))

    parsed = _parse_spf_record(records["example.com"], domain="example.com")

    assert parsed["lookup_count_estimate"] == 4
    assert parsed["resolution_tree"] == [
        "example.com: a (1 lookup)",
        "example.com: mx (1 lookup)",
        "example.com: include:relay.example.com (1 lookup)",
        "relay.example.com: include:mail.example.net (1 lookup)",
    ]
    assert parsed["issues"] == []


def test_parse_spf_record_flags_include_loops(monkeypatch) -> None:
    records = {
        "example.com": "v=spf1 include:loop.example.com -all",
        "loop.example.com": "v=spf1 include:example.com -all",
    }

    monkeypatch.setattr(dns_checks, "_find_spf_record", lambda host: records.get(host))

    parsed = _parse_spf_record(records["example.com"], domain="example.com")

    assert parsed["lookup_count_estimate"] == 2
    assert any("loop" in issue.lower() for issue in parsed["issues"])


def test_extract_mx_hosts_strips_priorities_and_trailing_dots() -> None:
    values = ["10 mx01.mail.icloud.com.", "20 mx02.mail.icloud.com."]

    assert _extract_mx_hosts(values) == ["mx01.mail.icloud.com", "mx02.mail.icloud.com"]


def test_cross_record_validation_flags_icloud_spf_gap_and_strict_alignment() -> None:
    mx = DnsRecordSet(
        host="example.com",
        record_type="MX",
        values=["10 mx01.mail.icloud.com.", "10 mx02.mail.icloud.com."],
    )
    spf = SpfResult(host="example.com", record="v=spf1 include:relay.example.net ~all")
    dmarc = DmarcResult(
        host="_dmarc.example.com",
        record="v=DMARC1; p=none; adkim=s; aspf=s",
        policy="none",
        alignment_dkim="s",
        alignment_spf="s",
        valid=True,
    )
    bimi = BimiResult(host="default._bimi.example.com")

    validations = build_cross_record_validations(mx, spf, dmarc, bimi)

    codes = {item.code for item in validations}
    assert "mx_spf_icloud_mismatch" in codes
    assert "dmarc_strict_spf_alignment" in codes
    assert "dmarc_strict_dkim_alignment" in codes


def test_cross_record_validation_suggests_bimi_when_dmarc_is_enforced() -> None:
    mx = DnsRecordSet(host="example.com", record_type="MX", values=[])
    spf = SpfResult(host="example.com", record="v=spf1 -all")
    dmarc = DmarcResult(
        host="_dmarc.example.com",
        record="v=DMARC1; p=reject",
        policy="reject",
        alignment_dkim="r",
        alignment_spf="r",
        valid=True,
    )
    bimi = BimiResult(host="default._bimi.example.com")

    validations = build_cross_record_validations(mx, spf, dmarc, bimi)

    assert any(item.code == "bimi_not_configured" for item in validations)


def test_build_findings_includes_blacklist_and_bimi_states() -> None:
    nameservers = DnsRecordSet(host="example.com", record_type="NS", values=["ns1.example.com."])
    mx = DnsRecordSet(host="example.com", record_type="MX", values=["10 mx1.example.com."])
    spf = SpfResult(host="example.com", record="v=spf1 -all", valid=True)
    dkim = DkimResult(host="default._domainkey.example.com")
    dmarc = DmarcResult(
        host="_dmarc.example.com",
        record="v=DMARC1; p=none",
        policy="none",
        alignment_dkim="r",
        alignment_spf="r",
        valid=True,
    )
    bimi = BimiResult(host="default._bimi.example.com")
    blacklist = BlacklistResult(
        checked_hosts=["mx1.example.com"],
        checked_ipv4_addresses=["203.0.113.20"],
        checks=[BlacklistCheck(zone="zen.spamhaus.org", label="Spamhaus ZEN", listed=False)],
    )

    findings = build_findings(nameservers, mx, spf, dkim, dmarc, bimi, blacklist)

    codes = {item.code for item in findings}
    assert "blacklist_clear" in codes
    assert "bimi_missing" in codes
