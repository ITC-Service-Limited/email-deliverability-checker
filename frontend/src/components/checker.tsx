"use client";

import { FormEvent, useState } from "react";

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

type ResponseData = {
  domain: string;
  nameservers: RecordSet;
  mx: RecordSet;
  spf: { host: string; record: string | null; lookup_count_estimate: number };
  dkim: { host: string; record: string | null; key_size_bits: number | null };
  dmarc: { host: string; record: string | null; tags: Record<string, string> };
  findings: Finding[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function severityColor(severity: Finding["severity"]) {
  if (severity === "error") return "var(--error)";
  if (severity === "warning") return "var(--warn)";
  return "var(--ok)";
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
                fontSize: 12
              }}
            >
              GitHub-first • Railway-ready • HubSpot-compatible
            </p>
            <h1
              style={{
                fontSize: "clamp(2.8rem, 8vw, 5.4rem)",
                lineHeight: 0.95,
                margin: "18px 0 18px"
              }}
            >
              Check the parts that actually shape email trust.
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
              with the checking engine exposed through an API that can later power a HubSpot app.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              borderRadius: 28,
              padding: 24,
              backdropFilter: "blur(8px)"
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
                  borderRadius: 999,
                  padding: "14px 18px",
                  background: "var(--accent)",
                  color: "white",
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
            <div style={panelStyle}>
              <h2 style={headingStyle}>Findings</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {result.findings.map((finding) => (
                  <div
                    key={finding.code}
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
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
              }}
            >
              <ResultCard title="SPF" body={result.spf.record ?? "No SPF record found."} />
              <ResultCard title="DKIM" body={result.dkim.record ?? "No DKIM record found for this selector."} />
              <ResultCard title="DMARC" body={result.dmarc.record ?? "No DMARC record found."} />
            </div>

            <div
              style={{
                display: "grid",
                gap: 18,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
              }}
            >
              <ResultCard
                title="Nameservers"
                body={result.nameservers.values.length ? result.nameservers.values.join("\n") : "No nameservers returned."}
                preformatted
              />
              <ResultCard
                title="MX"
                body={result.mx.values.length ? result.mx.values.join("\n") : "No MX records returned."}
                preformatted
              />
              <ResultCard
                title="Selector Host"
                body={`${result.dkim.host}\n\nEstimated key size: ${result.dkim.key_size_bits ?? "unknown"} bits`}
                preformatted
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ResultCard({
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

const panelStyle: React.CSSProperties = {
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow)",
  borderRadius: 24,
  padding: 24
};

const headingStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 12,
  fontSize: 20
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid var(--border)",
  padding: "14px 16px",
  background: "rgba(255,255,255,0.7)"
};
