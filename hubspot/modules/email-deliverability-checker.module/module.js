(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function describeSpfAll(qualifier) {
    if (qualifier === "-") return "Hard fail (-all)";
    if (qualifier === "~") return "Soft fail (~all)";
    if (qualifier === "?") return "Neutral (?all)";
    return qualifier ? "Allow all (+all)" : "No all mechanism";
  }

  function describeAlignment(value) {
    if (value === "s") return "Strict";
    if (value === "r") return "Relaxed";
    return "Unknown";
  }

  function extractDomain(value) {
    var cleaned = String(value || "").trim().toLowerCase();
    if (!cleaned) return "";
    if (cleaned.indexOf("@") !== -1) {
      return cleaned.split("@").pop();
    }
    return cleaned.replace(/^https?:\/\//, "").split("/")[0];
  }

  function statusTone(valid, hasRecord) {
    if (!hasRecord) {
      return { label: "Missing", color: "#e20512" };
    }
    if (valid) {
      return { label: "Healthy", color: "#1c8b4b" };
    }
    return { label: "Needs review", color: "#b86b00" };
  }

  function getFieldValue(formElement, fieldName) {
    if (!formElement || !fieldName) return "";
    var input = formElement.querySelector('[name="' + fieldName.replace(/"/g, '\\"') + '"]');
    return input ? input.value : "";
  }

  function normalizeFieldValues(submissionValues) {
    var values = {};
    if (!Array.isArray(submissionValues)) return values;

    submissionValues.forEach(function (field) {
      if (!field || !field.name) return;
      values[field.name] = field.value || "";
    });

    return values;
  }

  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function looksLikeDomain(value) {
    var cleaned = String(value || "").trim().toLowerCase();
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(cleaned);
  }

  function getFallbackFieldValues(formElement) {
    var values = {};
    if (!formElement) return values;

    var fields = formElement.querySelectorAll("input, textarea, select");
    fields.forEach(function (field) {
      if (!field.name) return;
      if (field.type === "checkbox" || field.type === "radio") {
        if (!field.checked) return;
      }
      values[field.name] = field.value || "";
    });

    return values;
  }

  function pickDomainValue(fieldValues, domainFieldName, emailFieldName) {
    if (!fieldValues) return "";

    var directDomain = extractDomain(fieldValues[domainFieldName]);
    if (directDomain) return directDomain;

    var directEmailDomain = extractDomain(fieldValues[emailFieldName]);
    if (directEmailDomain) return directEmailDomain;

    var domainCandidate = "";
    var emailCandidate = "";

    Object.keys(fieldValues).forEach(function (key) {
      var rawValue = String(fieldValues[key] || "").trim();
      if (!rawValue) return;

      if (!emailCandidate && looksLikeEmail(rawValue)) {
        emailCandidate = rawValue;
      }

      if (!domainCandidate && looksLikeDomain(rawValue)) {
        domainCandidate = rawValue;
      }
    });

    return extractDomain(domainCandidate || emailCandidate);
  }

  function getFormElement(formArg) {
    if (!formArg) return null;
    if (formArg.jquery) return formArg[0] || null;
    if (Array.isArray(formArg)) return formArg[0] || null;
    return formArg.nodeType ? formArg : null;
  }

  function setStatus(statusNode, tone, message) {
    if (!statusNode) return;
    if (!message) {
      statusNode.hidden = true;
      statusNode.textContent = "";
      statusNode.removeAttribute("data-tone");
      return;
    }
    statusNode.hidden = false;
    statusNode.setAttribute("data-tone", tone);
    statusNode.textContent = message;
  }

  function createBadge(label, color) {
    return '<span class="itc-deliverability-badge" style="background:' + escapeHtml(color) + '">' + escapeHtml(label) + "</span>";
  }

  function renderOverviewCard(title, value, detail, tone) {
    return [
      '<article class="itc-deliverability-overview-card">',
      '<div class="itc-deliverability-card-head">',
      '<h3>' + escapeHtml(title) + '</h3>',
      createBadge(tone.label, tone.color),
      '</div>',
      '<div class="itc-deliverability-value">' + escapeHtml(value) + '</div>',
      '<p class="itc-deliverability-detail">' + escapeHtml(detail) + '</p>',
      '</article>'
    ].join('');
  }

  function renderMetric(label, value) {
    return [
      '<div class="itc-deliverability-metric">',
      '<div class="itc-deliverability-metric-label">' + escapeHtml(label) + '</div>',
      '<div class="itc-deliverability-metric-value">' + escapeHtml(value) + '</div>',
      '</div>'
    ].join('');
  }

  function renderChips(items) {
    return items
      .map(function (item) {
        return '<span class="itc-deliverability-chip">' + escapeHtml(item) + '</span>';
      })
      .join('');
  }

  function renderListSection(title, items) {
    if (!items || !items.length) return '';
    return [
      '<div class="itc-deliverability-list-section">',
      '<h4>' + escapeHtml(title) + '</h4>',
      '<div class="itc-deliverability-chips">' + renderChips(items) + '</div>',
      '</div>'
    ].join('');
  }

  function renderProtocolCard(title, data, sections, listSections) {
    var tone = statusTone(Boolean(data.valid), Boolean(data.record));
    return [
      '<article class="itc-deliverability-protocol">',
      '<div class="itc-deliverability-card-head">',
      '<h3>' + escapeHtml(title) + '</h3>',
      createBadge(tone.label, tone.color),
      '</div>',
      '<div class="itc-deliverability-record">' + escapeHtml(data.record || ('No ' + title + ' record found.')) + '</div>',
      '<div class="itc-deliverability-metrics">' + sections.map(function (section) {
        return renderMetric(section.label, section.value);
      }).join('') + '</div>',
      listSections.map(function (section) {
        return renderListSection(section.title, section.items);
      }).join(''),
      '</article>'
    ].join('');
  }

  function renderLockedDkimCard(contactUrl) {
    return [
      '<article class="itc-deliverability-protocol">',
      '<div class="itc-deliverability-card-head">',
      '<h3>DKIM</h3>',
      createBadge('Contact us', '#e20512'),
      '</div>',
      '<div class="itc-deliverability-dkim-locked">',
      '<div class="itc-deliverability-dkim-preview" aria-hidden="true">',
      '<div class="itc-deliverability-record">v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...</div>',
      '<div class="itc-deliverability-metrics">',
      renderMetric('Selector host', 'default._domainkey.example.com'),
      renderMetric('Key type', 'rsa'),
      renderMetric('Estimated key size', '2048 bits'),
      '</div>',
      renderListSection('Hash algorithms', ['sha256', 'sha1']),
      '</div>',
      '<div class="itc-deliverability-dkim-overlay">',
      '<p class="itc-deliverability-eyebrow">Advanced check</p>',
      '<h4>DKIM review is handled directly by ITC</h4>',
      '<p>We validate selectors, signing keys, and alignment as part of a guided deliverability review.</p>',
      '<a class="itc-deliverability-button" href="' + escapeHtml(contactUrl) + '">Contact us</a>',
      '</div>',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderFindings(findings) {
    var visibleFindings = (findings || []).filter(function (finding) {
      var combined = ((finding.code || '') + ' ' + (finding.message || '')).toLowerCase();
      return combined.indexOf('dkim') === -1 && combined.indexOf('selector') === -1;
    });

    if (!visibleFindings.length) return '';

    return [
      '<section class="itc-deliverability-panel">',
      '<h3>Findings</h3>',
      '<div class="itc-deliverability-findings">',
      visibleFindings.map(function (finding) {
        var borderColor = finding.severity === 'error'
          ? '#e20512'
          : finding.severity === 'warning'
            ? '#b86b00'
            : '#1c1c1c';
        return [
          '<div class="itc-deliverability-finding" style="border-left-color:' + escapeHtml(borderColor) + '">',
          '<strong>' + escapeHtml(finding.severity) + '</strong>',
          '<p>' + escapeHtml(finding.message) + '</p>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderResults(result, contactUrl) {
    var spfTone = statusTone(Boolean(result.spf.valid), Boolean(result.spf.record));
    var dmarcTone = statusTone(Boolean(result.dmarc.valid), Boolean(result.dmarc.record));

    return [
      renderFindings(result.findings),
      '<section class="itc-deliverability-overview">',
      renderOverviewCard(
        'SPF',
        result.spf.record ? 'Record found' : 'Missing',
        String(result.spf.lookup_count_estimate) + ' lookup-style mechanisms',
        spfTone
      ),
      renderOverviewCard(
        'DKIM',
        'Expert review available',
        'Selector discovery, signing checks, and alignment validation handled by ITC.',
        { label: 'Contact us', color: '#e20512' }
      ),
      renderOverviewCard(
        'DMARC',
        result.dmarc.policy ? 'Policy: ' + result.dmarc.policy : 'Missing',
        result.dmarc.aggregate_reporting_enabled ? 'Aggregate reports enabled' : 'No aggregate reporting',
        dmarcTone
      ),
      '</section>',
      '<section class="itc-deliverability-grid">',
      renderProtocolCard('SPF', result.spf, [
        { label: 'Lookup estimate', value: String(result.spf.lookup_count_estimate) + ' / 10' },
        { label: 'Policy ending', value: describeSpfAll(result.spf.all_qualifier) },
        { label: 'Redirect', value: result.spf.redirect || 'None' }
      ], [
        { title: 'Includes', items: result.spf.includes || [] },
        { title: 'Mechanisms', items: result.spf.mechanisms || [] },
        { title: 'Issues', items: result.spf.issues || [] }
      ]),
      renderLockedDkimCard(contactUrl),
      renderProtocolCard('DMARC', result.dmarc, [
        { label: 'Policy', value: result.dmarc.policy || 'Missing' },
        { label: 'DKIM alignment', value: describeAlignment(result.dmarc.alignment_dkim) },
        { label: 'SPF alignment', value: describeAlignment(result.dmarc.alignment_spf) },
        { label: 'Subdomain policy', value: result.dmarc.subdomain_policy || 'Inherit main policy' },
        { label: 'Sampling', value: result.dmarc.pct !== null && result.dmarc.pct !== undefined ? String(result.dmarc.pct) + '%' : '100% default' },
        { label: 'Aggregate reports', value: result.dmarc.aggregate_reporting_enabled ? 'Enabled' : 'Not configured' }
      ], [
        { title: 'Record tags', items: Object.keys(result.dmarc.tags || {}).map(function (key) { return key + '=' + result.dmarc.tags[key]; }) }
      ]),
      '</section>',
      '<section class="itc-deliverability-footer-grid">',
      '<article class="itc-deliverability-simple-card"><h3>Nameservers</h3><pre>' + escapeHtml((result.nameservers.values || []).join('\n') || 'No nameservers returned.') + '</pre></article>',
      '<article class="itc-deliverability-simple-card"><h3>MX</h3><pre>' + escapeHtml((result.mx.values || []).join('\n') || 'No MX records returned.') + '</pre></article>',
      '</section>'
    ].filter(Boolean).join('');
  }

  function runCheck(root, domain) {
    var statusNode = root.querySelector('[data-status]');
    var resultsNode = root.querySelector('[data-results]');
    var apiBaseUrl = root.getAttribute('data-api-base-url') || '';
    var contactUrl = root.getAttribute('data-contact-url') || 'https://itcservice.co.uk';
    var loadingText = root.getAttribute('data-loading-text') || 'Running deliverability checks...';
    var errorText = root.getAttribute('data-error-text') || 'We could not complete the check just now. Please try again.';

    if (!domain) {
      setStatus(statusNode, 'error', 'Please submit a valid domain or email address.');
      if (resultsNode) {
        resultsNode.hidden = true;
        resultsNode.innerHTML = '';
      }
      return;
    }

    setStatus(statusNode, 'loading', loadingText);
    if (resultsNode) {
      resultsNode.hidden = true;
    }

    fetch(apiBaseUrl.replace(/\/$/, '') + '/api/v1/checks/domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain })
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('API request failed.');
        }
        return response.json();
      })
      .then(function (result) {
        setStatus(statusNode, '', '');
        if (!resultsNode) return;
        resultsNode.innerHTML = renderResults(result, contactUrl);
        resultsNode.hidden = false;
      })
      .catch(function () {
        setStatus(statusNode, 'error', errorText);
        if (resultsNode) {
          resultsNode.hidden = true;
          resultsNode.innerHTML = '';
        }
      });
  }

  function initModule(root, index) {
    var formTarget = root.querySelector('[data-hs-form]');
    if (!formTarget || !window.hbspt || !window.hbspt.forms) {
      return;
    }

    var portalId = formTarget.getAttribute('data-portal-id');
    var formId = formTarget.getAttribute('data-form-id');
    var domainFieldName = root.getAttribute('data-domain-field-name') || 'domain';
    var emailFieldName = root.getAttribute('data-email-field-name') || 'email';
    var targetId = 'itc-deliverability-form-' + index;

    formTarget.id = targetId;

    window.hbspt.forms.create({
      portalId: portalId,
      formId: formId,
      target: '#' + targetId,
      onBeforeFormSubmit: function ($form, submissionValues) {
        var formElement = getFormElement($form);
        var submittedValues = normalizeFieldValues(submissionValues);
        var fallbackValues = getFallbackFieldValues(formElement);
        var mergedValues = Object.assign({}, fallbackValues, submittedValues);
        var pendingDomain = pickDomainValue(mergedValues, domainFieldName, emailFieldName);
        root.setAttribute("data-pending-domain", pendingDomain);
      },
      onFormSubmitted: function ($form) {
        var formElement = getFormElement($form);
        var fallbackValues = getFallbackFieldValues(formElement);
        var pendingDomain = root.getAttribute("data-pending-domain") || "";
        var submittedDomain = pickDomainValue(fallbackValues, domainFieldName, emailFieldName);
        runCheck(root, pendingDomain || submittedDomain);
        root.removeAttribute("data-pending-domain");
      }
    });
  }

  function initAll() {
    var roots = document.querySelectorAll('[data-deliverability-root]');
    roots.forEach(function (root, index) {
      initModule(root, index);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
