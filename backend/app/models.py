from typing import Literal

from pydantic import BaseModel, Field


Severity = Literal["info", "warning", "error"]


class Finding(BaseModel):
    severity: Severity
    code: str
    message: str


class DnsRecordSet(BaseModel):
    host: str
    record_type: str
    values: list[str] = Field(default_factory=list)


class DomainCheckRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=255)


class DmarcResult(BaseModel):
    host: str
    record: str | None = None
    tags: dict[str, str] = Field(default_factory=dict)
    policy: str | None = None
    subdomain_policy: str | None = None
    alignment_dkim: str | None = None
    alignment_spf: str | None = None
    pct: int | None = None
    aggregate_reporting_enabled: bool = False
    valid: bool = False


class DkimResult(BaseModel):
    host: str
    record: str | None = None
    key_size_bits: int | None = None
    tags: dict[str, str] = Field(default_factory=dict)
    key_type: str | None = None
    hash_algorithms: list[str] = Field(default_factory=list)
    valid: bool = False


class SpfResult(BaseModel):
    host: str
    record: str | None = None
    lookup_count_estimate: int = 0
    includes: list[str] = Field(default_factory=list)
    resolution_tree: list[str] = Field(default_factory=list)
    redirect: str | None = None
    all_qualifier: str | None = None
    mechanisms: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    valid: bool = False


class DomainCheckResponse(BaseModel):
    domain: str
    nameservers: DnsRecordSet
    mx: DnsRecordSet
    spf: SpfResult
    dkim: DkimResult
    dmarc: DmarcResult
    findings: list[Finding] = Field(default_factory=list)
