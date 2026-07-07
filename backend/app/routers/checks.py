from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import DomainCheckRequest, DomainCheckResponse
from app.services.dns_checks import (
    build_cross_record_validations,
    build_findings,
    get_bimi,
    get_blacklist_status,
    get_dkim,
    get_dmarc,
    get_mx,
    get_nameservers,
    get_spf,
)

router = APIRouter(prefix="/api/v1/checks", tags=["checks"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/domain", response_model=DomainCheckResponse)
def run_domain_check(
    payload: DomainCheckRequest,
    settings: Settings = Depends(get_settings),
) -> DomainCheckResponse:
    domain = payload.domain.strip().lower()
    selector = settings.default_dkim_selector.strip()

    nameservers = get_nameservers(domain)
    mx = get_mx(domain)
    spf = get_spf(domain)
    dkim = get_dkim(domain, selector)
    dmarc = get_dmarc(domain)
    bimi = get_bimi(domain)
    blacklist = get_blacklist_status(mx)
    findings = build_findings(nameservers, mx, spf, dkim, dmarc, bimi, blacklist)
    cross_record_validations = build_cross_record_validations(mx, spf, dmarc, bimi)

    return DomainCheckResponse(
        domain=domain,
        nameservers=nameservers,
        mx=mx,
        spf=spf,
        dkim=dkim,
        dmarc=dmarc,
        bimi=bimi,
        blacklist=blacklist,
        findings=findings,
        cross_record_validations=cross_record_validations,
    )
