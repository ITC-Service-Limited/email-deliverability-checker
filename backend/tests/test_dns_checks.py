from app.services.dns_checks import (
    _estimate_spf_dns_lookups,
    _parse_dkim_record,
    _parse_dmarc_record,
    _parse_spf_record,
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
