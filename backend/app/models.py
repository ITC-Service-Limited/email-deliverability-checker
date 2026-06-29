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
    dkim_selector: str | None = Field(default=None, min_length=1, max_length=128)


class DmarcResult(BaseModel):
    host: str
    record: str | None = None
    tags: dict[str, str] = Field(default_factory=dict)


class DkimResult(BaseModel):
    host: str
    record: str | None = None
    key_size_bits: int | None = None


class SpfResult(BaseModel):
    host: str
    record: str | None = None
    lookup_count_estimate: int = 0


class DomainCheckResponse(BaseModel):
    domain: str
    nameservers: DnsRecordSet
    mx: DnsRecordSet
    spf: SpfResult
    dkim: DkimResult
    dmarc: DmarcResult
    findings: list[Finding] = Field(default_factory=list)
