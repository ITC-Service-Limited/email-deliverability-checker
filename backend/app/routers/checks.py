from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.models import DomainCheckRequest, DomainCheckResponse
from app.services.dns_checks import build_findings, get_dkim, get_dmarc, get_mx, get_nameservers, get_spf

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
    selector = (payload.dkim_selector or settings.default_dkim_selector).strip()

    nameservers = get_nameservers(domain)
    mx = get_mx(domain)
    spf = get_spf(domain)
    dkim = get_dkim(domain, selector)
    dmarc = get_dmarc(domain)
    findings = build_findings(nameservers, mx, spf, dkim, dmarc)

    return DomainCheckResponse(
        domain=domain,
        nameservers=nameservers,
        mx=mx,
        spf=spf,
        dkim=dkim,
        dmarc=dmarc,
        findings=findings,
    )
