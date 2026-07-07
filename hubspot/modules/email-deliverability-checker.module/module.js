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

  function findMatchingFieldValue(fieldValues, matcher) {
    if (!fieldValues) return "";

    var matchedKey = Object.keys(fieldValues).find(function (key) {
      return matcher.test(String(key || "").toLowerCase());
    });

    return matchedKey ? String(fieldValues[matchedKey] || "").trim() : "";
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

  function getVisibleFieldCandidates(formElement) {
    if (!formElement) return [];

    var fields = formElement.querySelectorAll("input, textarea, select");
    var candidates = [];

    fields.forEach(function (field) {
      if (!field || !field.name) return;
      if (field.disabled) return;
      if (field.type === "hidden") return;
      if (field.type === "checkbox" || field.type === "radio") return;
      if (field.type === "submit" || field.type === "button") return;

      var rawValue = String(field.value || "").trim();
      if (!rawValue) return;

      candidates.push({
        name: String(field.name || "").toLowerCase(),
        type: String(field.type || field.tagName || "").toLowerCase(),
        value: rawValue
      });
    });

    return candidates;
  }

  function pickDomainFromVisibleFields(formElement) {
    var candidates = getVisibleFieldCandidates(formElement);
    if (!candidates.length) return "";

    var preferredDomainCandidate = candidates.find(function (candidate) {
      return /domain|website|web_site|site|url/.test(candidate.name) && looksLikeDomain(candidate.value);
    });
    if (preferredDomainCandidate) return extractDomain(preferredDomainCandidate.value);

    var anyVisibleDomainCandidate = candidates.find(function (candidate) {
      return candidate.type !== "email" && looksLikeDomain(candidate.value);
    });
    if (anyVisibleDomainCandidate) return extractDomain(anyVisibleDomainCandidate.value);

    return "";
  }

  function pickDomainValue(fieldValues, domainFieldName, emailFieldName, formElement) {
    var visibleFieldDomain = pickDomainFromVisibleFields(formElement);
    if (visibleFieldDomain) return visibleFieldDomain;

    if (!fieldValues) return "";

    var directDomain = extractDomain(fieldValues[domainFieldName]);
    if (directDomain) return directDomain;

    var directEmailDomain = extractDomain(fieldValues[emailFieldName]);
    if (directEmailDomain) return directEmailDomain;

    var likelyDomainFieldValue = findMatchingFieldValue(fieldValues, /(domain|website|web_site|site|url)/);
    var likelyDomain = looksLikeDomain(likelyDomainFieldValue) ? extractDomain(likelyDomainFieldValue) : "";
    if (likelyDomain) return likelyDomain;

    var likelyEmailFieldValue = findMatchingFieldValue(fieldValues, /email/);
    var likelyEmailDomain = looksLikeEmail(likelyEmailFieldValue) ? extractDomain(likelyEmailFieldValue) : "";
    if (likelyEmailDomain) return likelyEmailDomain;

    return "";
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

  function renderFindingCard(finding) {
    return [
      '<div class="itc-deliverability-finding-card" data-severity="' + escapeHtml(finding.severity) + '">',
      '<div class="itc-deliverability-finding-label">' + escapeHtml(finding.severity) + '</div>',
      '<p class="itc-deliverability-detail">' + escapeHtml(finding.message) + '</p>',
      '</div>'
    ].join('');
  }

  function renderSectionHeader(kicker, title) {
    return [
      '<div class="itc-deliverability-section-header">',
      '<p class="itc-deliverability-kicker">' + escapeHtml(kicker) + '</p>',
      '<h3 class="itc-deliverability-section-title">' + escapeHtml(title) + '</h3>',
      '</div>'
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

  function renderProtocolSection(title, data, sections, listSections, options) {
    var config = options || {};
    var tone = statusTone(Boolean(data.valid), Boolean(data.record));
    return [
      '<article class="itc-deliverability-auth-section"' + (config.dark ? ' data-tone="dark"' : '') + '>',
      '<div class="itc-deliverability-card-head">',
      '<h3>' + escapeHtml(title) + '</h3>',
      createBadge(config.badgeLabel || tone.label, config.badgeColor || tone.color),
      '</div>',
      config.customIntro || '',
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
      '<article class="itc-deliverability-auth-section" data-tone="dark">',
      '<div class="itc-deliverability-card-head">',
      '<h3>DKIM</h3>',
      createBadge('Contact us', '#e20512'),
      '</div>',
      '<p class="itc-deliverability-locked-kicker">Advanced check</p>',
      '<h4 style="margin:0; font-size:38px; line-height:1.02; max-width:360px;">DKIM review is handled directly by ITC.</h4>',
      '<p class="itc-deliverability-detail" style="max-width:360px;">We validate selectors, signing keys, and alignment as part of a guided deliverability review.</p>',
      '<div class="itc-deliverability-locked-action"><a class="itc-deliverability-button" href="' + escapeHtml(contactUrl) + '">Contact us</a></div>',
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
      '<section class="itc-deliverability-section">',
      renderSectionHeader('Findings', 'Summary of what we detected.'),
      '<div class="itc-deliverability-findings-grid">',
      visibleFindings.map(renderFindingCard).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderCrossRecordValidations(validations) {
    if (!validations || !validations.length) return '';

    return [
      '<section class="itc-deliverability-section">',
      renderSectionHeader('Cross-record validation', 'How these records work together.'),
      '<div class="itc-deliverability-findings-grid">',
      validations.map(renderFindingCard).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderBlacklistCard(blacklist) {
    var checks = blacklist && blacklist.checks ? blacklist.checks : [];
    var listedCount = checks.filter(function (check) { return check.listed; }).length;
    var hasChecks = checks.length > 0;
    var summary = !hasChecks
      ? 'Blacklist checks are not available for this result yet.'
      : listedCount
        ? 'Found on ' + listedCount + ' of ' + checks.length + ' blacklist' + (checks.length === 1 ? '' : 's') + ' checked'
        : 'Not found on any of ' + checks.length + ' blacklist' + (checks.length === 1 ? '' : 's') + ' checked';
    var checkedIps = (blacklist.checked_ipv4_addresses || []).join(', ');

    return [
      '<article class="itc-deliverability-simple-card itc-deliverability-blacklist-card" data-listed="' + (listedCount ? 'true' : 'false') + '" data-empty="' + (!hasChecks ? 'true' : 'false') + '">',
      '<div class="itc-deliverability-card-head">',
      '<h3>Blacklist status</h3>',
      createBadge(!hasChecks ? 'Unavailable' : listedCount ? 'Listed' : 'Clear', !hasChecks ? '#b86b00' : listedCount ? '#b86b00' : '#1c8b4b'),
      '</div>',
      '<div class="itc-deliverability-record">' + escapeHtml(summary) + '</div>',
      (hasChecks ? [
      '<div class="itc-deliverability-list-section">',
      '<h4>Checked services</h4>',
      '<ul class="itc-deliverability-blacklist-list">',
      checks.map(function (check) {
        return '<li class="itc-deliverability-blacklist-item"><span class="itc-deliverability-blacklist-item-icon" aria-hidden="true">' + (check.listed ? '!' : 'OK') + '</span><span>' + escapeHtml(check.label) + '</span></li>';
      }).join(''),
      '</ul>',
      '</div>'].join('') : ''),
      '<div class="itc-deliverability-blacklist-ips"><span>Checked IPs:</span> ' + escapeHtml(checkedIps || 'None') + '</div>',
      '</article>'
    ].join('');
  }

  function renderBimiCard(bimi) {
    var tone = statusTone(Boolean(bimi.valid), Boolean(bimi.record));

    return [
      '<article class="itc-deliverability-simple-card">',
      '<div class="itc-deliverability-card-head">',
      '<h3>BIMI</h3>',
      createBadge(tone.label, tone.color),
      '</div>',
      '<div class="itc-deliverability-record">' + escapeHtml(bimi.record || 'No BIMI record found at the default selector.') + '</div>',
      renderListSection('Record tags', Object.keys(bimi.tags || {}).map(function (key) {
        return key + '=' + bimi.tags[key];
      })),
      '</article>'
    ].join('');
  }

  function renderResults(result, contactUrl) {
    return [
      '<div class="itc-deliverability-results-meta">Results for <strong>' + escapeHtml(result.domain || '') + '</strong></div>',
      renderFindings(result.findings),
      renderCrossRecordValidations(result.cross_record_validations),
      '<section class="itc-deliverability-section">',
      renderSectionHeader('Authentication checks', 'SPF, DKIM and DMARC at a glance.'),
      '<div class="itc-deliverability-auth-columns">',
      renderProtocolSection('SPF', result.spf, [
        { label: 'Lookup estimate', value: String(result.spf.lookup_count_estimate) + ' / 10' },
        { label: 'Policy ending', value: describeSpfAll(result.spf.all_qualifier) },
        { label: 'Redirect', value: result.spf.redirect || 'None' }
      ], [
        { title: 'Includes', items: result.spf.includes || [] },
        { title: 'Resolution tree', items: result.spf.resolution_tree || [] },
        { title: 'Mechanisms', items: result.spf.mechanisms || [] },
        { title: 'Issues', items: result.spf.issues || [] }
      ]),
      renderLockedDkimCard(contactUrl),
      renderProtocolSection('DMARC', result.dmarc, [
        { label: 'Policy', value: result.dmarc.policy || 'Missing' },
        { label: 'DKIM alignment', value: describeAlignment(result.dmarc.alignment_dkim) },
        { label: 'SPF alignment', value: describeAlignment(result.dmarc.alignment_spf) },
        { label: 'Subdomain policy', value: result.dmarc.subdomain_policy || 'Inherit main policy' },
        { label: 'Sampling', value: result.dmarc.pct !== null && result.dmarc.pct !== undefined ? String(result.dmarc.pct) + '%' : '100% default' },
        { label: 'Aggregate reports', value: result.dmarc.aggregate_reporting_enabled ? 'Enabled' : 'Not configured' }
      ], [
        { title: 'Record tags', items: Object.keys(result.dmarc.tags || {}).map(function (key) { return key + '=' + result.dmarc.tags[key]; }) }
      ]),
      '</div>',
      '</section>',
      '<section class="itc-deliverability-footer-grid">',
      '<article class="itc-deliverability-simple-card"><h3>Nameservers</h3><pre>' + escapeHtml((result.nameservers.values || []).join('\n') || 'No nameservers returned.') + '</pre></article>',
      '<article class="itc-deliverability-simple-card"><h3>MX</h3><pre>' + escapeHtml((result.mx.values || []).join('\n') || 'No MX records returned.') + '</pre></article>',
      '</section>',
      '<section class="itc-deliverability-footer-grid">',
      renderBimiCard(result.bimi || {}),
      renderBlacklistCard(result.blacklist || {}),
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
        root.setAttribute("data-submitted", "true");
        setStatus(statusNode, 'success', 'Thanks for submitting the form.');
        if (!resultsNode) return;
        resultsNode.innerHTML = renderResults(result, contactUrl);
        resultsNode.hidden = false;
      })
      .catch(function () {
        root.removeAttribute("data-submitted");
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
        var pendingDomain = pickDomainValue(mergedValues, domainFieldName, emailFieldName, formElement);
        root.setAttribute("data-pending-domain", pendingDomain);
      },
      onFormSubmitted: function ($form) {
        var formElement = getFormElement($form);
        var fallbackValues = getFallbackFieldValues(formElement);
        var pendingDomain = root.getAttribute("data-pending-domain") || "";
        var submittedDomain = pickDomainValue(fallbackValues, domainFieldName, emailFieldName, formElement);
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
