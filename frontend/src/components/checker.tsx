"use client";

import { FormEvent, ReactNode, useState } from "react";

type Finding = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
};

type RecordSet = {
  host: string;
  record_type: string;
  values: string[];
};

type SpfData = {
  host: string;
  record: string | null;
  lookup_count_estimate: number;
  includes: string[];
  redirect: string | null;
  all_qualifier: string | null;
  mechanisms: string[];
  issues: string[];
  valid: boolean;
};

type DkimData = {
  host: string;
  record: string | null;
  key_size_bits: number | null;
  tags: Record<string, string>;
  key_type: string | null;
  hash_algorithms: string[];
  valid: boolean;
};

type DmarcData = {
  host: string;
  record: string | null;
  tags: Record<string, string>;
  policy: string | null;
  subdomain_policy: string | null;
  alignment_dkim: string | null;
  alignment_spf: string | null;
  pct: number | null;
  aggregate_reporting_enabled: boolean;
  valid: boolean;
};

type ResponseData = {
  domain: string;
  nameservers: RecordSet;
  mx: RecordSet;
  spf: SpfData;
  dkim: DkimData;
  dmarc: DmarcData;
  findings: Finding[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function severityColor(severity: Finding["severity"]) {
  if (severity === "error") return "var(--error)";
  if (severity === "warning") return "var(--warn)";
  return "var(--ok)";
}

function statusTone(valid: boolean, hasRecord: boolean) {
  if (!hasRecord) return { label: "Missing", color: "var(--error)" };
  if (valid) return { label: "Healthy", color: "var(--ok)" };
  return { label: "Needs review", color: "var(--warn)" };
}

export function Checker() {
  const [domain, setDomain] = useState("");
  const [selector, setSelector] = useState("default");
  const [result, setResult] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/checks/domain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domain,
          dkim_selector: selector
        })
      });

      if (!response.ok) {
        throw new Error("The API request failed.");
      }

      const data = (await response.json()) as ResponseData;
      setResult(data);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while running the check."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 20px 80px"
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto"
        }}
      >
        <section
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            alignItems: "start"
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "var(--accent)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              GitHub-first • Railway-ready • HubSpot-compatible
            </p>
            <h1
              style={{
                fontSize: "clamp(2.2rem, 5.2vw, 4.1rem)",
                lineHeight: 1.02,
                margin: "18px 0 18px",
                fontFamily: "var(--title-font)",
                letterSpacing: "-0.04em",
                fontWeight: 700
              }}
            >
              Make sender trust visible before it becomes a delivery problem.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.6,
                color: "var(--muted)",
                maxWidth: 720
              }}
            >
              Run live SPF, DKIM, DMARC, MX, and nameserver checks from a single screen,
              then inspect the details that explain why a domain looks healthy, weak, or
              incomplete through an ITC-style diagnostics workspace.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              borderRadius: 0,
              padding: 24,
              backdropFilter: "blur(14px)"
            }}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span>Domain</span>
                <input
                  required
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="example.com"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span>DKIM selector</span>
                <input
                  value={selector}
                  onChange={(event) => setSelector(event.target.value)}
                  placeholder="default"
                  style={inputStyle}
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 8,
                  border: 0,
                  borderRadius: 0,
                  padding: "14px 18px",
                  background: "var(--accent)",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: loading ? "progress" : "pointer"
                }}
              >
                {loading ? "Running live checks..." : "Run live check"}
              </button>
            </div>

            <p style={{ margin: "14px 0 0", color: "var(--muted)", fontSize: 14 }}>
              This MVP is stateless. Nothing is stored unless we add persistence later.
            </p>
          </form>
        </section>

        {error ? (
          <div style={{ ...panelStyle, marginTop: 28, borderColor: "rgba(159, 45, 45, 0.25)" }}>
            <strong>Request failed.</strong>
            <p style={{ marginBottom: 0 }}>{error}</p>
          </div>
        ) : null}

        {result ? (
          <section style={{ marginTop: 28, display: "grid", gap: 18 }}>
            <OverviewRow result={result} />

            <div style={panelStyle}>
              <h2 style={headingStyle}>Findings</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {result.findings.map((finding, index) => (
                  <div
                    key={`${finding.code}-${index}`}
                    style={{
                      borderLeft: `4px solid ${severityColor(finding.severity)}`,
                      paddingLeft: 14
                    }}
                  >
                    <strong style={{ textTransform: "capitalize" }}>{finding.severity}</strong>
                    <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{finding.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 18,
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))"
              }}
            >
              <ProtocolCard
                title="SPF"
                tone={statusTone(result.spf.valid, Boolean(result.spf.record))}
                record={result.spf.record}
                sections={[
                  {
                    label: "Lookup estimate",
                    value: `${result.spf.lookup_count_estimate} / 10`
                  },
                  {
                    label: "Policy ending",
                    value: result.spf.all_qualifier
                      ? describeSpfAll(result.spf.all_qualifier)
                      : "No all mechanism"
                  },
                  {
                    label: "Redirect",
                    value: result.spf.redirect ?? "None"
                  }
                ]}
                listSections={[
                  {
                    title: "Includes",
                    items: result.spf.includes
                  },
                  {
                    title: "Mechanisms",
                    items: result.spf.mechanisms
                  },
                  {
                    title: "Issues",
                    items: result.spf.issues
                  }
                ]}
              />

              <ProtocolCard
                title="DKIM"
                tone={statusTone(result.dkim.valid, Boolean(result.dkim.record))}
                record={result.dkim.record}
                sections={[
                  {
                    label: "Selector host",
                    value: result.dkim.host
                  },
                  {
                    label: "Key type",
                    value: result.dkim.key_type ?? "Unknown"
                  },
                  {
                    label: "Estimated key size",
                    value: result.dkim.key_size_bits
                      ? `${result.dkim.key_size_bits} bits`
                      : "Unknown"
                  }
                ]}
                listSections={[
                  {
                    title: "Hash algorithms",
                    items: result.dkim.hash_algorithms
                  },
                  {
                    title: "Record tags",
                    items: Object.entries(result.dkim.tags).map(([key, value]) => `${key}=${value}`)
                  }
                ]}
              />

              <ProtocolCard
                title="DMARC"
                tone={statusTone(result.dmarc.valid, Boolean(result.dmarc.record))}
                record={result.dmarc.record}
                sections={[
                  {
                    label: "Policy",
                    value: result.dmarc.policy ?? "Missing"
                  },
                  {
                    label: "DKIM alignment",
                    value: describeAlignment(result.dmarc.alignment_dkim)
                  },
                  {
                    label: "SPF alignment",
                    value: describeAlignment(result.dmarc.alignment_spf)
                  },
                  {
                    label: "Subdomain policy",
                    value: result.dmarc.subdomain_policy ?? "Inherit main policy"
                  },
                  {
                    label: "Sampling",
                    value: result.dmarc.pct !== null ? `${result.dmarc.pct}%` : "100% default"
                  },
                  {
                    label: "Aggregate reports",
                    value: result.dmarc.aggregate_reporting_enabled ? "Enabled" : "Not configured"
                  }
                ]}
                listSections={[
                  {
                    title: "Record tags",
                    items: Object.entries(result.dmarc.tags).map(([key, value]) => `${key}=${value}`)
                  }
                ]}
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 18,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
              }}
            >
              <SimpleCard
                title="Nameservers"
                body={
                  result.nameservers.values.length
                    ? result.nameservers.values.join("\n")
                    : "No nameservers returned."
                }
                preformatted
              />
              <SimpleCard
                title="MX"
                body={
                  result.mx.values.length ? result.mx.values.join("\n") : "No MX records returned."
                }
                preformatted
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function OverviewRow({ result }: { result: ResponseData }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
      }}
    >
      <OverviewCard
        title="SPF"
        value={result.spf.record ? "Record found" : "Missing"}
        detail={`${result.spf.lookup_count_estimate} lookup-style mechanisms`}
        color={statusTone(result.spf.valid, Boolean(result.spf.record)).color}
      />
      <OverviewCard
        title="DKIM"
        value={result.dkim.valid ? "Selector healthy" : result.dkim.record ? "Needs review" : "Missing"}
        detail={result.dkim.key_size_bits ? `${result.dkim.key_size_bits} bit key estimate` : "Key size unknown"}
        color={statusTone(result.dkim.valid, Boolean(result.dkim.record)).color}
      />
      <OverviewCard
        title="DMARC"
        value={result.dmarc.policy ? `Policy: ${result.dmarc.policy}` : "Missing"}
        detail={
          result.dmarc.aggregate_reporting_enabled
            ? "Aggregate reports enabled"
            : "No aggregate reporting"
        }
        color={statusTone(result.dmarc.valid, Boolean(result.dmarc.record)).color}
      />
    </div>
  );
}

function OverviewCard({
  title,
  value,
  detail,
  color
}: {
  title: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <article style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={headingStyle}>{title}</h2>
        <span
          style={{
            color,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase"
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ fontSize: 24, lineHeight: 1.15 }}>{value}</div>
      <p style={{ color: "var(--muted)", marginBottom: 0 }}>{detail}</p>
    </article>
  );
}

function ProtocolCard({
  title,
  tone,
  record,
  sections,
  listSections
}: {
  title: string;
  tone: { label: string; color: string };
  record: string | null;
  sections: Array<{ label: string; value: string }>;
  listSections: Array<{ title: string; items: string[] }>;
}) {
  return (
    <article style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={headingStyle}>{title}</h2>
        <span
          style={{
            color: tone.color,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase"
          }}
        >
          {tone.label}
        </span>
      </div>

      <div style={recordBoxStyle}>{record ?? `No ${title} record found.`}</div>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {sections.map((section) => (
          <MetricRow key={`${title}-${section.label}`} label={section.label}>
            {section.value}
          </MetricRow>
        ))}
      </div>

      <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
        {listSections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <div key={`${title}-${section.title}`}>
              <h3 style={subheadingStyle}>{section.title}</h3>
              <div style={chipWrapStyle}>
                {section.items.map((item) => (
                  <span key={`${title}-${section.title}-${item}`} style={chipStyle}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </article>
  );
}

function MetricRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
        gap: 12,
        alignItems: "start"
      }}
    >
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div style={{ wordBreak: "break-word" }}>{children}</div>
    </div>
  );
}

function SimpleCard({
  title,
  body,
  preformatted = false
}: {
  title: string;
  body: string;
  preformatted?: boolean;
}) {
  return (
    <article style={panelStyle}>
      <h2 style={headingStyle}>{title}</h2>
      <div
        style={{
          color: "var(--muted)",
          whiteSpace: preformatted ? "pre-wrap" : "normal",
          lineHeight: 1.6,
          wordBreak: "break-word"
        }}
      >
        {body}
      </div>
    </article>
  );
}

function describeSpfAll(qualifier: string) {
  if (qualifier === "-") return "Hard fail (-all)";
  if (qualifier === "~") return "Soft fail (~all)";
  if (qualifier === "?") return "Neutral (?all)";
  return "Allow all (+all)";
}

function describeAlignment(value: string | null) {
  if (value === "s") return "Strict";
  if (value === "r") return "Relaxed";
  return "Unknown";
}

const panelStyle: React.CSSProperties = {
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow)",
  borderRadius: 0,
  padding: 24,
  backdropFilter: "blur(12px)"
};

const headingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 20,
  fontFamily: "var(--title-font)"
};

const subheadingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 8,
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted)"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 0,
  border: "1px solid var(--border)",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.92)",
  color: "var(--text)"
};

const recordBoxStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 0,
  background: "rgba(28, 28, 28, 0.03)",
  border: "1px solid rgba(28, 28, 28, 0.12)",
  color: "var(--muted)",
  lineHeight: 1.6,
  wordBreak: "break-word"
};

const chipWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 10px",
  borderRadius: 0,
  background: "var(--accent-soft)",
  border: "1px solid rgba(226, 5, 18, 0.18)",
  color: "var(--text)",
  fontSize: 13
};
