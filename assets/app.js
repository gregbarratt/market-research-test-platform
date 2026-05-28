(function () {
  const AUTH_KEY = "qmtCurrentClient";
  const DEMO_PASSWORD = "12345";
  const DEMO_CLIENTS = [
    { name: "Person Client", email: "person@mail.com", initials: "PC" },
    { name: "Sarah Mitchell", email: "sarah@mail.com", initials: "SM" },
    { name: "David Hughes", email: "david@mail.com", initials: "DH" },
    { name: "Emma Wilson", email: "emma@mail.com", initials: "EW" },
    { name: "James Patel", email: "james@mail.com", initials: "JP" },
    { name: "Aisha Khan", email: "aisha@mail.com", initials: "AK" },
    { name: "Michael Brown", email: "michael@mail.com", initials: "MB" }
  ];

  const loginForm = document.getElementById("loginForm");
  if (loginForm) setupLoginForm(loginForm);

  const currentClient = getCurrentClient();
  if (document.body.dataset.requireAuth === "true" && !currentClient) {
    const loginUrl = new URL(document.body.dataset.loginPath || "/login/", window.location.href);
    loginUrl.searchParams.set("return", window.location.href);
    window.location.href = loginUrl.toString();
    return;
  }

  updateClientShell(currentClient);

  const heroSearch = document.getElementById("heroSearch");
  if (heroSearch) {
    heroSearch.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = document.getElementById("tripPrompt").value.trim();
      const next = new URL("dashboard/client/tour-request/new/", window.location.href);
      if (value) {
        next.searchParams.set("title", value);
      }
      window.location.href = next.toString();
    });
  }

  const quoteRequestsList = document.getElementById("quoteRequestsList");
  const expandedQuoteRequests = new Set();
  if (quoteRequestsList) {
    const firstQuotedRequest = getDashboardRequests()
      .find((request) => Array.isArray(request.agentQuotes) && request.agentQuotes.length);
    if (firstQuotedRequest) expandedQuoteRequests.add(firstQuotedRequest.id);
    quoteRequestsList.addEventListener("click", handleDashboardClick);
    renderDashboardRequests();
  }

  const form = document.getElementById("tourRequestForm");
  if (!form) return;

  const query = new URLSearchParams(window.location.search);
  ["title", "tourType", "destination", "departureAirport", "dateFrom", "dateTo", "adults", "children", "budget", "description", "bookingLink"].forEach((name) => {
    const value = query.get(name);
    if (value && form.elements[name]) {
      form.elements[name].value = value;
    }
  });
  if (!query.get("adults") && query.get("persons") && form.elements.adults) {
    form.elements.adults.value = query.get("persons");
  }

  const childAgesWrap = document.getElementById("childAgesWrap");
  const childAgeGrid = document.getElementById("childAgeGrid");
  const presetChildAges = query.get("childAges");
  const childAgeValues = presetChildAges ? presetChildAges.split(",").map((age) => age.trim()) : [];

  renderChildAges();
  form.elements.children.addEventListener("input", renderChildAges);

  const fileInput = document.getElementById("fileInput");
  const uploadTrigger = document.getElementById("uploadTrigger");
  const fileChips = document.getElementById("fileChips");
  const files = [];

  uploadTrigger.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    Array.from(fileInput.files || []).forEach((file) => {
      if (!files.some((item) => item.name === file.name)) {
        files.push(file);
      }
    });
    fileInput.value = "";
    renderFiles();
  });

  function renderFiles() {
    fileChips.innerHTML = "";
    files.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "file-chip";
      chip.innerHTML = "<span></span><button type=\"button\" aria-label=\"Remove file\">x</button>";
      chip.querySelector("span").textContent = file.name;
      chip.querySelector("button").addEventListener("click", () => {
        files.splice(index, 1);
        renderFiles();
      });
      fileChips.appendChild(chip);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();
    const data = Object.fromEntries(new FormData(form).entries());
    const errors = {};

    if (!data.title.trim()) errors.title = "Tour title is required";
    if (!data.tourType) errors.tourType = "Please select a tour type";
    if (!data.destination.trim()) errors.destination = "Destination is required";
    if (!data.departureAirport.trim()) errors.departureAirport = "Departure airport is required";
    if (!data.dateFrom) errors.dateFrom = "Start date is required";
    if (!data.dateTo) errors.dateTo = "End date is required";
    if (data.dateFrom && data.dateTo && data.dateTo < data.dateFrom) errors.dateTo = "End date must be after start date";
    if (!data.adults || Number(data.adults) < 1) errors.adults = "At least 1 adult required";
    if (data.children && Number(data.children) < 0) errors.children = "Children cannot be below 0";
    if (data.bookingLink.trim() && !isLikelyUrl(data.bookingLink.trim())) {
      errors.bookingLink = "Please enter a valid booking or quote link";
    }
    const childCount = Math.max(0, Number(data.children) || 0);
    for (let index = 0; index < childCount; index += 1) {
      const age = data[`childAge${index + 1}`];
      if (age === undefined || age === "" || Number(age) < 0 || Number(age) > 17) {
        errors.childAges = "Please enter each child's age from 0 to 17";
        break;
      }
    }
    if (!data.budget.trim()) errors.budget = "Please enter a budget";

    Object.entries(errors).forEach(([name, message]) => {
      const target = document.querySelector(`[data-error-for="${name}"]`);
      if (target) target.textContent = message;
    });

    if (Object.keys(errors).length) return;

    saveQuoteRequest(data);

    const panel = document.getElementById("successPanel");
    form.hidden = true;
    panel.hidden = false;
    const strongTitle = data.title.trim();
    if (strongTitle) {
      panel.querySelector("p").textContent = `Your request for ${strongTitle} has been sent. Agents will review and submit proposals shortly.`;
    }
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function clearErrors() {
    document.querySelectorAll("[data-error-for]").forEach((node) => {
      node.textContent = "";
    });
  }

  function isLikelyUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function renderChildAges() {
    const count = Math.max(0, Math.min(12, Number(form.elements.children.value) || 0));
    childAgesWrap.hidden = count === 0;
    childAgeGrid.innerHTML = "";

    for (let index = 0; index < count; index += 1) {
      const label = document.createElement("label");
      label.className = "field child-age-field";
      label.innerHTML = `<span>Child ${index + 1} age</span><input name="childAge${index + 1}" type="number" min="0" max="17" placeholder="Age" />`;
      label.querySelector("input").value = childAgeValues[index] || "";
      childAgeGrid.appendChild(label);
    }
  }

  function saveQuoteRequest(data) {
    const childCount = Math.max(0, Number(data.children) || 0);
    const childAges = [];
    for (let index = 0; index < childCount; index += 1) {
      childAges.push(data[`childAge${index + 1}`]);
    }

    const request = {
      id: `QMT-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "Awaiting quotes",
      quotesReceived: 0,
      maxQuotes: 5,
      agentQuotes: [],
      clientEmail: (getCurrentClient()?.email || "person@mail.com").toLowerCase(),
      title: data.title.trim(),
      tourType: data.tourType,
      destination: data.destination.trim(),
      departureAirport: data.departureAirport.trim(),
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      adults: data.adults,
      children: data.children || "0",
      childAges,
      budget: data.budget.trim(),
      description: data.description.trim(),
      bookingLink: data.bookingLink.trim()
    };

    const requests = loadQuoteRequests();
    requests.unshift(request);
    localStorage.setItem(getClientStorageKey("qmtQuoteRequests"), JSON.stringify(requests));
  }

  function renderDashboardRequests() {
    const requests = getDashboardRequests();
    const total = document.getElementById("statTotal");
    const pending = document.getElementById("statPending");

    if (total) total.textContent = String(requests.length);
    if (pending) pending.textContent = String(requests.filter((request) => getQuoteState(request).received < getQuoteState(request).max).length);

    if (!requests.length) {
      quoteRequestsList.innerHTML = `
        <div class="empty-quotes">
          <h3>No quote requests yet</h3>
          <p>Once you submit a holiday quote request, it will appear on this dashboard.</p>
          <a class="submit-button" href="tour-request/new/">Request a Quote</a>
        </div>
      `;
      return;
    }

    quoteRequestsList.innerHTML = requests.map((request) => {
      const dates = `${formatDate(request.dateFrom)} - ${formatDate(request.dateTo)}`;
      const children = Number(request.children) || 0;
      const childAges = children ? `, children ages ${(request.childAges || []).join(", ")}` : "";
      const bookingLink = request.bookingLink
        ? `<a class="quote-link" href="${escapeHtml(request.bookingLink)}" target="_blank" rel="noreferrer">View booking link</a>`
        : "";
      const status = request.status || "Awaiting quotes";
      const departure = request.departureAirport || "departure airport not set";
      const quoteState = getQuoteState(request);
      const agentQuotes = Array.isArray(request.agentQuotes) ? request.agentQuotes : [];
      const quoteDecisions = loadQuoteDecisions();
      const isExpanded = expandedQuoteRequests.has(request.id);
      const quoteImage = getQuoteImage(request);
      const quoteLabel = quoteState.received >= quoteState.max
        ? "Curated offers ready"
        : quoteState.received > 0
          ? "Offers arriving"
          : "Request received";
      const progressWidth = `${Math.round((quoteState.received / quoteState.max) * 100)}%`;
      const waitingText = quoteState.received >= quoteState.max
        ? "All verified agents have quoted"
        : quoteState.received === 0
          ? "No agent quotes yet"
          : `Waiting on ${quoteState.max - quoteState.received} more`;
      const quoteToggle = agentQuotes.length
        ? `<button class="quote-view-button" type="button" data-action="toggle-quotes" data-request-id="${escapeHtml(request.id)}">${isExpanded ? "Close holiday quote" : `View holiday quote (${agentQuotes.length})`}</button>`
        : `<span class="quote-empty-pill">No agent quotes yet</span>`;
      const agentQuoteDetails = isExpanded
        ? renderAgentQuoteDetails(request, agentQuotes, quoteDecisions)
        : "";

      return `
        <article class="quote-request-card ${isExpanded ? "quote-request-card-open" : ""}">
          <div class="quote-card-media" style="background-image: url('${escapeHtml(quoteImage)}')">
            <span>${escapeHtml(quoteLabel)}</span>
          </div>
          <div class="quote-request-main">
            <span class="quote-status ${escapeHtml(quoteState.className)}">${escapeHtml(status)}</span>
            <h3>${escapeHtml(request.title)}</h3>
            <p>${escapeHtml(request.destination)} from ${escapeHtml(departure)}</p>
            <dl>
              <div><dt>Dates</dt><dd>${escapeHtml(dates)}</dd></div>
              <div><dt>Passengers</dt><dd>${escapeHtml(request.adults)} adults, ${children} children${escapeHtml(childAges)}</dd></div>
              <div><dt>Budget</dt><dd>${escapeHtml(request.budget)}</dd></div>
              <div><dt>Type</dt><dd>${escapeHtml(request.tourType)}</dd></div>
            </dl>
            <div class="quote-progress">
              <div>
                <strong>${quoteState.received} of ${quoteState.max} agents quoted</strong>
                <span>${escapeHtml(waitingText)}</span>
              </div>
              <span class="quote-progress-bar"><i style="width: ${progressWidth}"></i></span>
            </div>
          </div>
          <div class="quote-request-side">
            <strong>${escapeHtml(request.id)}</strong>
            <span>Submitted ${escapeHtml(formatDate(request.createdAt))}</span>
            ${bookingLink}
            ${quoteToggle}
          </div>
          ${agentQuoteDetails}
        </article>
      `;
    }).join("");
  }

  function renderAgentQuoteDetails(request, agentQuotes, quoteDecisions) {
    if (!agentQuotes.length) {
      return `<div class="quote-details-panel"><p class="quote-empty-note">Agents have not submitted quotes yet.</p></div>`;
    }

    return `
      <div class="quote-details-panel">
        <div class="quote-details-heading">
          <div>
            <strong>Your curated agent offers</strong>
            <span>Compare the detail, retrieve the PDF, then accept or reject each quote.</span>
          </div>
        </div>
        <div class="agent-quote-grid">
          ${agentQuotes.map((quote, index) => {
            const decision = getQuoteDecision(quoteDecisions, request.id, quote.agent);
            const decisionLabel = decision ? `<span class="decision-badge decision-${escapeHtml(decision)}">${escapeHtml(decision)}</span>` : "";
            const rating = quote.rating || "4.7";
            const reviews = quote.reviews || "Verified agent";
            const inclusions = Array.isArray(quote.inclusions) ? quote.inclusions : [quote.note, "PDF quote available"];
            const badge = index === 0 ? "Recommended" : Number(rating) >= 4.8 ? "Top rated" : "Verified";

            return `
              <article class="agent-quote-card">
                <span class="premium-agent-badge">${escapeHtml(badge)}</span>
                <div class="agent-quote-topline">
                  <div>
                    <strong>${escapeHtml(quote.agent)}</strong>
                    <span class="agent-rating">
                      <span class="star-rating" aria-label="Rated ${escapeHtml(rating)} out of 5">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                      <b>${escapeHtml(rating)}</b>
                      <em>${escapeHtml(reviews)}</em>
                    </span>
                  </div>
                  <strong class="agent-quote-price">${escapeHtml(quote.price)}</strong>
                </div>
                <p>${escapeHtml(quote.note)}</p>
                <ul class="quote-feature-list">
                  ${inclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                </ul>
                <div class="agent-quote-actions">
                  <button type="button" data-action="retrieve-pdf" data-request-id="${escapeHtml(request.id)}" data-agent="${escapeHtml(quote.agent)}">Retrieve PDF</button>
                  <button class="${decision === "accepted" ? "is-active" : ""}" type="button" data-action="accept-quote" data-request-id="${escapeHtml(request.id)}" data-agent="${escapeHtml(quote.agent)}">Accept</button>
                  <button class="${decision === "rejected" ? "is-active is-rejected" : ""}" type="button" data-action="reject-quote" data-request-id="${escapeHtml(request.id)}" data-agent="${escapeHtml(quote.agent)}">Reject</button>
                  ${decisionLabel}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function handleDashboardClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target || !quoteRequestsList.contains(target)) return;

    const action = target.dataset.action;
    const requestId = target.dataset.requestId;
    const agent = target.dataset.agent;

    if (action === "toggle-quotes") {
      if (expandedQuoteRequests.has(requestId)) {
        expandedQuoteRequests.delete(requestId);
      } else {
        expandedQuoteRequests.add(requestId);
      }
      renderDashboardRequests();
      return;
    }

    if (action === "accept-quote") {
      const request = getDashboardRequests().find((item) => item.id === requestId);
      if (request) showAcceptConfirmation(request, agent);
      return;
    }

    if (action === "reject-quote") {
      setQuoteDecision(requestId, agent, "rejected");
      expandedQuoteRequests.add(requestId);
      renderDashboardRequests();
      return;
    }

    if (action === "retrieve-pdf") {
      event.preventDefault();
      event.stopPropagation();
      const request = getDashboardRequests().find((item) => item.id === requestId);
      const quote = request && Array.isArray(request.agentQuotes)
        ? request.agentQuotes.find((item) => item.agent === agent)
        : null;
      if (request && quote) {
        const originalLabel = target.textContent;
        target.textContent = "Preparing PDF...";
        target.disabled = true;

        try {
          downloadQuotePdf(request, quote);
          target.textContent = "PDF downloaded";
        } catch (error) {
          console.error("PDF download failed", error);
          target.textContent = "Try again";
        }

        window.setTimeout(() => {
          target.disabled = false;
          target.textContent = originalLabel || "Retrieve PDF";
        }, 1800);
      }
    }
  }

  function loadQuoteDecisions() {
    try {
      return JSON.parse(localStorage.getItem(getClientStorageKey("qmtQuoteDecisions")) || "{}");
    } catch {
      return {};
    }
  }

  function saveQuoteDecisions(decisions) {
    localStorage.setItem(getClientStorageKey("qmtQuoteDecisions"), JSON.stringify(decisions));
  }

  function getQuoteDecision(decisions, requestId, agent) {
    return decisions?.[requestId]?.[agent] || "";
  }

  function setQuoteDecision(requestId, agent, decision) {
    const decisions = loadQuoteDecisions();
    decisions[requestId] = decisions[requestId] || {};

    if (decision === "accepted") {
      Object.entries(decisions[requestId]).forEach(([agentName, currentDecision]) => {
        if (currentDecision === "accepted" && agentName !== agent) {
          delete decisions[requestId][agentName];
        }
      });
    }

    decisions[requestId][agent] = decision;
    saveQuoteDecisions(decisions);
  }

  function showAcceptConfirmation(request, agent) {
    closeAcceptConfirmation();
    const client = getCurrentClient();
    const modal = document.createElement("div");
    modal.className = "accept-confirmation-backdrop";
    modal.innerHTML = `
      <section class="accept-confirmation-box" role="dialog" aria-modal="true" aria-labelledby="acceptConfirmTitle">
        <button class="accept-confirmation-close" type="button" data-confirm-action="cancel" aria-label="Close confirmation">x</button>
        <span class="premium-agent-badge">Final confirmation</span>
        <h2 id="acceptConfirmTitle">Send customer details to ${escapeHtml(agent)}?</h2>
        <p>
          Confirming will email the customer's contact details and trip request to
          <strong>${escapeHtml(agent)}</strong> so they can complete the booking.
        </p>
        <dl class="accept-confirmation-summary">
          <div><dt>Customer</dt><dd>${escapeHtml(client?.name || "Customer")} ${client?.email ? `(${escapeHtml(client.email)})` : ""}</dd></div>
          <div><dt>Holiday</dt><dd>${escapeHtml(request.title)}</dd></div>
          <div><dt>Reference</dt><dd>${escapeHtml(request.id)}</dd></div>
        </dl>
        <div class="accept-confirmation-actions">
          <button type="button" data-confirm-action="cancel">Cancel</button>
          <button type="button" data-confirm-action="confirm">Confirm & send to agent</button>
        </div>
      </section>
    `;

    modal.addEventListener("click", (event) => {
      const action = event.target.closest("[data-confirm-action]")?.dataset.confirmAction;
      if (!action && event.target !== modal) return;

      if (action === "confirm") {
        setQuoteDecision(request.id, agent, "accepted");
        expandedQuoteRequests.add(request.id);
        renderDashboardRequests();
      }

      closeAcceptConfirmation();
    });

    document.body.appendChild(modal);
  }

  function closeAcceptConfirmation() {
    document.querySelector(".accept-confirmation-backdrop")?.remove();
  }

  function downloadQuotePdf(request, quote) {
    const filename = `${slugify(request.id)}-${slugify(quote.agent)}-quote.pdf`;
    const pdf = buildSmartQuotePdf(request, quote);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const opened = window.open(url, "_blank", "noopener");
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (!opened) {
      window.location.href = url;
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function ensureHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve();
    if (window.__qmtHtml2PdfLoading) return window.__qmtHtml2PdfLoading;

    window.__qmtHtml2PdfLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("html2pdf could not be loaded"));
      document.head.appendChild(script);
    });

    return window.__qmtHtml2PdfLoading;
  }

  function buildSmartQuotePdfElement(request, quote) {
    const dates = `${formatDate(request.dateFrom)} - ${formatDate(request.dateTo)}`;
    const childCount = Number(request.children) || 0;
    const passengers = `${request.adults} adults${childCount ? `, ${childCount} children` : ""}`;
    const inclusions = Array.isArray(quote.inclusions) && quote.inclusions.length
      ? quote.inclusions
      : [quote.note, "PDF quote available", "Subject to live availability"];
    const price = normalisePound(quote.price);
    const perPerson = normalisePound(getPerPersonPrice(quote.price, request.adults, request.children));
    const image = getQuoteImage(request);

    const wrapper = document.createElement("div");
    wrapper.className = "smart-quote-export-wrap";
    wrapper.style.cssText = "position:fixed;left:0;top:0;width:794px;background:#eaf4fb;pointer-events:none;z-index:2147483647;";
    wrapper.innerHTML = `
      <style>
        .smart-quote-export-page,
        .smart-quote-export-page * {
          box-sizing: border-box;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .smart-quote-export-page {
          width: 794px;
          min-height: 1123px;
          padding: 22px 28px 24px;
          background: #eaf4fb;
          color: #15213a;
          font-family: Inter, Arial, sans-serif;
          font-size: 13px;
        }

        .sq-header {
          text-align: center;
          margin-bottom: 14px;
        }

        .sq-logo {
          color: #173f7a;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .sq-updated {
          margin-top: 4px;
          color: #64708a;
          font-size: 11px;
        }

        .sq-banner {
          height: 134px;
          display: flex;
          align-items: flex-end;
          padding: 18px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(8, 20, 40, 0.05), rgba(8, 20, 40, 0.68)), url("${escapeHtml(image)}") center / cover;
          color: #ffffff;
          overflow: hidden;
        }

        .sq-banner h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
        }

        .sq-banner p {
          margin: 7px 0 0;
          color: rgba(255, 255, 255, 0.84);
          font-size: 13px;
        }

        .sq-summary {
          display: grid;
          grid-template-columns: 185px 1fr;
          gap: 14px;
          margin-top: 14px;
        }

        .sq-price-card,
        .sq-agent-card,
        .sq-section,
        .sq-flight-card,
        .sq-action-panel {
          border: 1px solid #d7e2f0;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 10px 24px rgba(16, 41, 84, 0.08);
        }

        .sq-price-card {
          display: flex;
          min-height: 118px;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: #143f78;
          color: #ffffff;
          text-align: center;
        }

        .sq-price-card span,
        .sq-price-card em {
          font-size: 12px;
          font-style: normal;
          opacity: 0.9;
        }

        .sq-price-card strong {
          display: block;
          margin: 7px 0;
          font-size: 30px;
        }

        .sq-agent-card {
          display: grid;
          grid-template-columns: 86px 1fr 128px;
          gap: 16px;
          align-items: center;
          min-height: 118px;
          padding: 16px;
        }

        .sq-avatar {
          width: 74px;
          height: 74px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #eaf4ff;
          color: #1476ff;
          font-size: 24px;
          font-weight: 900;
        }

        .sq-agent-card h2 {
          margin: 0 0 4px;
          font-size: 22px;
        }

        .sq-muted {
          color: #64708a;
        }

        .sq-rating {
          display: none;
          margin-top: 7px;
          color: #8a5a00;
          font-weight: 900;
        }

        .sq-rating-clean {
          margin-top: 7px;
          color: #8a5a00;
          font-weight: 900;
        }

        .sq-trust-stack {
          display: grid;
          gap: 7px;
          justify-items: end;
        }

        .sq-status-pill {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          background: #e9f8ef;
          color: #0c7040;
          font-weight: 900;
          white-space: nowrap;
        }

        .sq-trust-mark {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          border-radius: 999px;
          background: #f4f8fe;
          color: #143f78;
          border: 1px solid #d7e2f0;
          font-size: 11px;
          font-weight: 900;
        }

        .sq-section {
          margin-top: 14px;
          padding: 16px;
        }

        .sq-section h3 {
          margin: 0 0 12px;
          color: #1476ff;
          font-size: 18px;
        }

        .sq-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .sq-detail {
          min-height: 55px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #f5f8fc;
        }

        .sq-detail span {
          display: block;
          color: #64708a;
          font-size: 11px;
          font-weight: 800;
        }

        .sq-detail strong {
          display: block;
          margin-top: 4px;
          font-size: 14px;
        }

        .sq-holiday-copy {
          margin: 0 0 10px;
          color: #64708a;
          line-height: 1.45;
        }

        .sq-inclusions {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .sq-inclusions li {
          margin: 6px 0;
          font-weight: 800;
        }

        .sq-inclusions li::before {
          content: "";
          width: 7px;
          height: 7px;
          display: inline-block;
          margin-right: 8px;
          border-radius: 50%;
          background: #1476ff;
          vertical-align: middle;
        }

        .sq-flight-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .sq-flight-card {
          padding: 14px;
          box-shadow: none;
        }

        .sq-flight-card h4 {
          margin: 0 0 9px;
          font-size: 16px;
        }

        .sq-flight-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 6px;
          color: #64708a;
        }

        .sq-action-grid {
          display: grid;
          grid-template-columns: 1fr 210px;
          gap: 14px;
          align-items: stretch;
          margin-top: 14px;
        }

        .sq-action-panel {
          padding: 16px;
        }

        .sq-action-panel h3 {
          margin: 0 0 8px;
          color: #15213a;
        }

        .sq-action-buttons {
          display: grid;
          gap: 9px;
          margin-top: 14px;
        }

        .sq-accept,
        .sq-reject {
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-weight: 900;
        }

        .sq-accept {
          background: #0c7040;
          color: #ffffff;
        }

        .sq-reject {
          background: #fff1f1;
          color: #bd2d2d;
        }

        .sq-footer {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #143f78;
          color: #ffffff;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
        }

        .sq-small-print {
          margin: 8px 0 0;
          color: #64708a;
          font-size: 11px;
          line-height: 1.35;
        }
      </style>
      <div class="smart-quote-export-page">
        <div class="sq-header">
          <div class="sq-logo">${escapeHtml(quote.agent)}</div>
          <div class="sq-updated">Agent company quote | Last Updated at: 27 May 2026, 07:55 PM</div>
        </div>

        <div class="sq-banner">
          <div>
            <h1>${escapeHtml(quote.agent)} Quote</h1>
            <p>${escapeHtml(request.title)} | ${escapeHtml(request.id)}</p>
          </div>
        </div>

        <div class="sq-summary">
          <div class="sq-price-card">
            <span>Total Price</span>
            <strong>${escapeHtml(price)}</strong>
            <em>Per Person: ${escapeHtml(perPerson)}</em>
            <em>Deposit: ${escapeHtml(price)}</em>
          </div>

          <div class="sq-agent-card">
            <div class="sq-avatar">${escapeHtml(getInitials(quote.agent))}</div>
            <div>
              <h2>${escapeHtml(quote.agent)}</h2>
              <div class="sq-muted">Provided by: ${escapeHtml(quote.agent)}</div>
              <div class="sq-rating-clean">&#9733;&#9733;&#9733;&#9733;&#9733; ${escapeHtml(quote.rating || "4.7")} | ${escapeHtml(quote.reviews || "Verified agent")}</div>
              <div class="sq-rating">★★★★★ ${escapeHtml(quote.rating || "4.7")} | ${escapeHtml(quote.reviews || "Verified agent")}</div>
            </div>
            <div class="sq-trust-stack">
              <div class="sq-status-pill">Quote ready</div>
              <div class="sq-trust-mark">ATOL protected</div>
              <div class="sq-trust-mark">ABTA / CTA</div>
            </div>
          </div>
        </div>

        <div class="sq-section">
          <h3>Booking Details</h3>
          <div class="sq-detail-grid">
            ${quoteDetail("Holiday", request.title)}
            ${quoteDetail("Destination", request.destination)}
            ${quoteDetail("Travel Dates", dates)}
            ${quoteDetail("Departure", request.departureAirport || "Departure airport TBC")}
            ${quoteDetail("Passengers", passengers)}
            ${quoteDetail("Budget", normalisePound(request.budget))}
          </div>
        </div>

        <div class="sq-section">
          <h3>Hotel / Holiday Information</h3>
          <p class="sq-holiday-copy">${escapeHtml(quote.note)}</p>
          <ul class="sq-inclusions">
            ${inclusions.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>

        <div class="sq-section">
          <h3>Flight Details</h3>
          <div class="sq-flight-grid">
            ${flightCard("Departure Flight", "Outbound", request.departureAirport || "UK airport", request.destination, formatDate(request.dateFrom))}
            ${flightCard("Return Flight", "Inbound", request.destination, request.departureAirport || "UK airport", formatDate(request.dateTo))}
          </div>
        </div>

        <div class="sq-action-grid">
          <div class="sq-section" style="margin-top:0;">
            <h3>Terms & Conditions</h3>
            <p class="sq-holiday-copy">Customer accepts the agent terms and conditions, privacy policy and live availability checks before confirming the booking.</p>
            <p class="sq-small-print">All prices are subject to live availability at the point of booking. This quote is prepared for market research testing and mirrors the Smart Quote customer journey.</p>
          </div>
          <div class="sq-action-panel">
            <h3>Customer action</h3>
            <div class="sq-muted">Review this quote, then accept or reject the agent offer.</div>
            <div class="sq-action-buttons">
              <div class="sq-accept">Accept Quote</div>
              <div class="sq-reject">Reject Quote</div>
            </div>
          </div>
        </div>

        <div class="sq-footer">Company Name: ${escapeHtml(quote.agent)} &nbsp; | &nbsp; ATOL / ABTA / CTA approved &nbsp; | &nbsp; Smart Quote format</div>
      </div>
    `;

    return wrapper;
  }

  function quoteDetail(label, value) {
    return `<div class="sq-detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "TBC")}</strong></div>`;
  }

  function flightCard(title, type, from, to, date) {
    return `
      <div class="sq-flight-card">
        <h4>${escapeHtml(title)}</h4>
        <div class="sq-flight-row"><strong>Type</strong><span>${escapeHtml(type)}</span></div>
        <div class="sq-flight-row"><strong>From</strong><span>${escapeHtml(from)}</span></div>
        <div class="sq-flight-row"><strong>To</strong><span>${escapeHtml(to)}</span></div>
        <div class="sq-flight-row"><strong>Date</strong><span>${escapeHtml(date)}</span></div>
      </div>
    `;
  }

  function buildSmartQuotePdf(request, quote) {
    const pageWidth = 612;
    const pageHeight = 792;
    const ops = [];
    const dates = `${formatDate(request.dateFrom)} - ${formatDate(request.dateTo)}`;
    const childCount = Number(request.children) || 0;
    const childAges = childCount && Array.isArray(request.childAges) && request.childAges.length
      ? `, ages ${request.childAges.join(", ")}`
      : "";
    const passengers = `${request.adults} adults, ${childCount} children${childAges}`;
    const inclusions = Array.isArray(quote.inclusions) && quote.inclusions.length
      ? quote.inclusions
      : [quote.note, "PDF quote available", "Subject to live availability"];
    const totalPrice = toPdfCurrency(quote.price);
    const perPerson = toPdfCurrency(getPerPersonPrice(quote.price, request.adults, request.children));
    const deposit = toPdfCurrency(getDepositPrice(quote.price));
    const updated = formatQuoteUpdatedDate();

    rect(0, 0, pageWidth, pageHeight, "#eef5fb");
    rect(0, 736, pageWidth, 56, "#ffffff");
    text(quote.agent, 45, 768, 22, "#12315d", true);
    text("Holiday quote for " + wrapOneLine(request.title, 44), 45, 750, 10, "#65728a", false);
    text("Last updated: " + updated, 394, 763, 8, "#65728a", false);
    text("Reference: " + request.id, 394, 750, 8, "#65728a", true);

    rect(45, 642, 152, 78, "#123f7a");
    text("Total Price", 66, 696, 10, "#ffffff", true);
    text(totalPrice, 66, 671, 23, "#ffffff", true);
    text("Per Person: " + perPerson, 66, 656, 9, "#ffffff", false);
    text("Deposit Today: " + deposit, 66, 645, 9, "#ffffff", false);

    rect(214, 642, 353, 78, "#ffffff", "#d8e2ee");
    rect(232, 659, 44, 44, "#eaf4ff", "#cfe4ff");
    text(getInitials(quote.agent), 245, 675, 14, "#1476ff", true);
    text(quote.agent, 292, 697, 17, "#102a4c", true);
    text("Agent company quote", 292, 682, 10, "#65728a", false);
    text("Rating: " + (quote.rating || "4.7") + " / 5  |  " + (quote.reviews || "Verified agent"), 292, 668, 10, "#8a5a00", true);
    pill("Quote ready", 463, 688, 76, 18, "#e9f8ef", "#0c7040");
    pill("ATOL", 463, 662, 34, 18, "#f4f8fe", "#143f78");
    pill("ABTA / CTA", 503, 662, 58, 18, "#f4f8fe", "#143f78");

    sectionTitle("Booking Details", 45, 615);
    detailBox(45, 567, 164, "Holiday", request.title);
    detailBox(224, 567, 164, "Destination", request.destination);
    detailBox(403, 567, 164, "Travel Dates", dates);
    detailBox(45, 521, 164, "Departure", request.departureAirport || "Departure airport TBC");
    detailBox(224, 521, 164, "Passengers", passengers);
    detailBox(403, 521, 164, "Original Budget", toPdfCurrency(request.budget));

    sectionTitle("Holiday Information", 45, 492);
    rect(45, 386, 522, 88, "#ffffff", "#d8e2ee");
    holidayVisual(397, 404, 148, 52, request);
    text(request.title, 62, 456, 14, "#102a4c", true);
    drawWrapped(quote.note, 62, 440, 49, 10, 9, "#65728a", false);
    let inclusionY = 414;
    inclusions.slice(0, 3).forEach((item) => {
      rect(62, inclusionY + 2, 5, 5, "#1476ff");
      text(wrapOneLine(item, 47), 74, inclusionY, 9, "#102a4c", true);
      inclusionY -= 12;
    });

    sectionTitle("Flight Details", 45, 360);
    flightBox(45, 270, "Departure Flight", "Outbound", request.departureAirport || "UK airport", request.destination, formatDate(request.dateFrom));
    flightBox(319, 270, "Return Flight", "Inbound", request.destination, request.departureAirport || "UK airport", formatDate(request.dateTo));

    sectionTitle("Customer Decision", 45, 238);
    rect(45, 154, 336, 68, "#ffffff", "#d8e2ee");
    text("Terms & Conditions", 62, 204, 12, "#102a4c", true);
    drawWrapped("Customer accepts the agent terms, privacy policy and live availability checks before confirming the booking.", 62, 188, 62, 10, 8, "#65728a", false);
    drawWrapped("All prices are subject to live availability at the point of booking.", 62, 166, 62, 10, 8, "#65728a", false);

    rect(397, 154, 170, 68, "#ffffff", "#d8e2ee");
    text("Customer action", 414, 204, 12, "#102a4c", true);
    rect(414, 173, 61, 22, "#0c7040");
    text("Accept", 429, 180, 10, "#ffffff", true);
    rect(487, 173, 61, 22, "#fff1f1", "#f1caca");
    text("Reject", 503, 180, 10, "#bd2d2d", true);

    rect(45, 116, 522, 28, "#123f7a");
    text("Company Name: " + quote.agent + "  |  ATOL / ABTA / CTA approved  |  Smart Quote format", 62, 127, 8, "#ffffff", true);

    function sectionTitle(label, x, y) {
      text(label, x, y, 14, "#1476ff", true);
      line(x + 124, y + 4, 567, y + 4, "#d8e2ee");
    }

    function detailBox(x, y, w, label, value) {
      rect(x, y, w, 40, "#ffffff", "#d8e2ee");
      text(label, x + 12, y + 24, 8, "#65728a", true);
      text(wrapOneLine(value, 22), x + 12, y + 9, 10, "#102a4c", true);
    }

    function flightBox(x, y, title, type, from, to, date) {
      rect(x, y, 248, 74, "#ffffff", "#d8e2ee");
      text(title, x + 14, y + 54, 12, "#102a4c", true);
      text(date, x + 164, y + 55, 8, "#1476ff", true);
      text("Type", x + 14, y + 39, 8, "#65728a", true);
      text(type, x + 72, y + 39, 9, "#102a4c", true);
      text("From", x + 14, y + 26, 8, "#65728a", true);
      text(wrapOneLine(from, 27), x + 72, y + 26, 9, "#102a4c", true);
      text("To", x + 14, y + 13, 8, "#65728a", true);
      text(wrapOneLine(to, 27), x + 72, y + 13, 9, "#102a4c", true);
    }

    function pill(label, x, y, w, h, fill, color) {
      rect(x, y, w, h, fill, "#d8e2ee");
      text(label, x + 8, y + 7, 8, color, true);
    }

    function holidayVisual(x, y, w, h, requestData) {
      const theme = `${requestData.title || ""} ${requestData.tourType || ""} ${requestData.destination || ""}`.toLowerCase();
      rect(x, y, w, h, "#dff1ff", "#cbdcec");

      if (theme.includes("city") || theme.includes("new york") || theme.includes("paris") || theme.includes("rome")) {
        rect(x, y, w, 16, "#b8d8f2");
        rect(x + 12, y + 16, 16, 24, "#214a76");
        rect(x + 34, y + 10, 20, 34, "#2f6696");
        rect(x + 60, y + 20, 16, 20, "#173a61");
        rect(x + 83, y + 12, 24, 30, "#2b5d88");
        rect(x + 114, y + 24, 16, 16, "#173a61");
        return;
      }

      if (theme.includes("snow") || theme.includes("lapland") || theme.includes("ski") || theme.includes("norway") || theme.includes("finland")) {
        rect(x, y, w, 15, "#c7e4ff");
        line(x + 12, y + 15, x + 48, y + 45, "#ffffff");
        line(x + 48, y + 45, x + 86, y + 15, "#ffffff");
        line(x + 58, y + 15, x + 98, y + 42, "#eaf6ff");
        line(x + 98, y + 42, x + 138, y + 15, "#eaf6ff");
        rect(x + 20, y + 12, 112, 6, "#ffffff");
        return;
      }

      if (theme.includes("cruise") || theme.includes("ship")) {
        rect(x, y, w, 18, "#1e8bd1");
        rect(x + 28, y + 16, 82, 12, "#ffffff", "#d8e2ee");
        rect(x + 42, y + 28, 54, 8, "#dff1ff", "#cbdcec");
        rect(x + 56, y + 36, 26, 6, "#ffffff", "#d8e2ee");
        line(x + 16, y + 15, x + 126, y + 15, "#ffffff");
        line(x + 24, y + 11, x + 138, y + 11, "#a7ddff");
        return;
      }

      rect(x, y, w, 14, "#1e8bd1");
      rect(x, y + 14, w, 12, "#f3d391");
      rect(x + 104, y + 36, 18, 10, "#ffd257");
      line(x + 24, y + 18, x + 42, y + 42, "#1c7d68");
      line(x + 42, y + 42, x + 60, y + 27, "#1c7d68");
      line(x + 42, y + 42, x + 33, y + 30, "#1c7d68");
    }

    function drawWrapped(value, x, y, maxLength, lineHeight, size, color, bold) {
      wrapText(value, maxLength).slice(0, 3).forEach((lineText, index) => {
        text(lineText, x, y - (index * lineHeight), size, color, bold);
      });
    }

    function text(value, x, y, size, color, bold) {
      ops.push("BT", `${pdfColor(color)} rg`, `/${bold ? "F2" : "F1"} ${size} Tf`, `${x} ${y} Td`, `(${escapePdfText(value)}) Tj`, "ET");
    }

    function rect(x, y, w, h, fill, stroke) {
      ops.push(`${pdfColor(fill)} rg`, `${x} ${y} ${w} ${h} re`, "f");
      if (stroke) {
        ops.push(`${pdfColor(stroke)} RG`, "0.8 w", `${x} ${y} ${w} ${h} re`, "S");
      }
    }

    function line(x1, y1, x2, y2, color) {
      ops.push(`${pdfColor(color)} RG`, "0.8 w", `${x1} ${y1} m`, `${x2} ${y2} l`, "S");
    }

    const stream = ops.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets[index + 1] = pdf.length;
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
  }

  function pdfColor(hex) {
    const value = String(hex || "#000000").replace("#", "");
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    return `${trimPdfNumber(r)} ${trimPdfNumber(g)} ${trimPdfNumber(b)}`;
  }

  function trimPdfNumber(value) {
    return Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function getPerPersonPrice(price, adults, children) {
    const total = parseMoney(price);
    const passengers = Math.max(1, (Number(adults) || 0) + (Number(children) || 0));
    return total ? `GBP ${Math.round(total / passengers).toLocaleString("en-GB")}` : "TBC";
  }

  function getDepositPrice(price) {
    const total = parseMoney(price);
    return total ? `GBP ${Math.max(99, Math.round(total * 0.1)).toLocaleString("en-GB")}` : "TBC";
  }

  function parseMoney(value) {
    const numeric = String(value || "").replace(/[^\d.]/g, "");
    return Number(numeric) || 0;
  }

  function normalisePound(value) {
    const text = String(value || "").trim();
    if (!text) return "TBC";
    if (/flexible/i.test(text)) return "Flexible";

    const amount = parseMoney(text);
    if (amount) {
      return `${String.fromCharCode(163)}${Math.round(amount).toLocaleString("en-GB")}`;
    }

    return text
      .replaceAll("Â£", String.fromCharCode(163))
      .replaceAll("Ã‚Â£", String.fromCharCode(163))
      .replaceAll("GBP ", String.fromCharCode(163));
  }

  function toPdfCurrency(value) {
    return normalisePound(value);
    return String(value || "TBC").replaceAll("£", "GBP ").replaceAll("Â£", "GBP ");
  }

  function formatQuoteUpdatedDate() {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date());
  }

  function wrapText(value, maxLength) {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxLength && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });

    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function wrapOneLine(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
  }

  function escapePdfText(value) {
    const pound = String.fromCharCode(163);
    return String(value ?? "")
      .replaceAll("Â£", pound)
      .replaceAll("Ã‚Â£", pound)
      .replaceAll("GBP ", pound)
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)")
      .replaceAll(pound, "\\243")
      .replace(/[^\x20-\x7e]/g, "");
    return String(value ?? "")
      .replaceAll("£", "GBP ")
      .replaceAll("\u00a3", "GBP ")
      .replace(/[^\x20-\x7e]/g, "")
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
  }

  function getInitials(value) {
    const initials = String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");

    return initials || "QT";
  }

  function slugify(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "quote";
  }

  function setupLoginForm(formNode) {
    const demoList = document.getElementById("demoClientList");
    const errorNode = document.querySelector("[data-login-error]");
    const signedInClient = getCurrentClient();

    if (demoList) {
      demoList.innerHTML = DEMO_CLIENTS.map((client) => `
        <button type="button" data-demo-email="${escapeHtml(client.email)}">
          <strong>${escapeHtml(client.name)}</strong>
          <span>${escapeHtml(client.email)}</span>
        </button>
      `).join("");

      demoList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-demo-email]");
        if (!button) return;
        formNode.elements.email.value = button.dataset.demoEmail;
        formNode.elements.password.value = DEMO_PASSWORD;
      });
    }

    if (signedInClient) {
      formNode.elements.email.value = signedInClient.email;
    }

    formNode.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = formNode.elements.email.value.trim().toLowerCase();
      const password = formNode.elements.password.value.trim();
      const client = DEMO_CLIENTS.find((item) => item.email === email);

      if (!client || password !== DEMO_PASSWORD) {
        if (errorNode) errorNode.textContent = "We could not sign you in with those details.";
        return;
      }

      localStorage.setItem(AUTH_KEY, JSON.stringify(client));
      const returnUrl = new URLSearchParams(window.location.search).get("return");
      if (returnUrl && returnUrl.startsWith(window.location.origin)) {
        window.location.href = returnUrl;
      } else {
        window.location.href = formNode.dataset.dashboardPath || "../dashboard/client/";
      }
    });
  }

  function updateClientShell(client) {
    document.querySelectorAll("[data-client-name]").forEach((node) => {
      node.textContent = client?.name || "Client Dashboard";
    });
    document.querySelectorAll("[data-client-email]").forEach((node) => {
      node.textContent = client?.email || "";
    });
    document.querySelectorAll(".avatar").forEach((node) => {
      node.textContent = client?.initials || "GB";
    });

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        localStorage.removeItem(AUTH_KEY);
        window.location.href = logoutButton.dataset.loginPath || "../../login/";
      });
    }
  }

  function getCurrentClient() {
    try {
      const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (!stored?.email) return null;
      return DEMO_CLIENTS.find((client) => client.email === stored.email.toLowerCase()) || null;
    } catch {
      return null;
    }
  }

  function getClientStorageKey(baseKey) {
    const email = getCurrentClient()?.email || "person@mail.com";
    return `${baseKey}:${email}`;
  }

  function getDashboardRequests() {
    return mergeQuoteRequests(loadQuoteRequests(), getDemoQuoteRequests());
  }

  function getDemoQuoteRequests() {
    return [
      {
        id: "QMT-184205",
        createdAt: "2026-05-27T10:15:00.000Z",
        status: "5 of 5 agents quoted",
        quotesReceived: 5,
        maxQuotes: 5,
        title: "Mediterranean Cruise",
        tourType: "Cruise",
        destination: "Barcelona, Rome & Greek Islands",
        departureAirport: "London Gatwick (LGW)",
        dateFrom: "2026-06-05",
        dateTo: "2026-06-15",
        adults: "4",
        children: "0",
        childAges: [],
        budget: "£22,500",
        description: "Balcony cabin preferred with excursions included.",
        bookingLink: "",
        agentQuotes: [
          { agent: "Ocean Blue Travel", price: "£21,940", rating: "4.9", reviews: "312 reviews", note: "Balcony cabin, drinks package", inclusions: ["Balcony cabin", "Drinks package", "Private return transfers"] },
          { agent: "Harbour Holidays", price: "£22,180", rating: "4.7", reviews: "188 reviews", note: "Flights and transfers included", inclusions: ["Direct flights", "Return transfers", "ATOL protected"] },
          { agent: "CruiseLine Experts", price: "£21,760", rating: "4.8", reviews: "241 reviews", note: "Best value, inside transfers", inclusions: ["Best value fare", "Inside transfers", "Full board cruise"] },
          { agent: "Atlas Travel Co", price: "£22,450", rating: "4.6", reviews: "96 reviews", note: "Premium cabin upgrade", inclusions: ["Premium cabin", "Excursion support", "Flexible payment"] },
          { agent: "Voyage Desk", price: "£22,100", rating: "4.5", reviews: "74 reviews", note: "Excursion credit included", inclusions: ["Excursion credit", "On-board support", "Low deposit"] }
        ]
      },
      {
        id: "QMT-184188",
        createdAt: "2026-05-27T14:40:00.000Z",
        status: "2 of 5 agents quoted",
        quotesReceived: 2,
        maxQuotes: 5,
        title: "Tenerife Half-Term Sun",
        tourType: "Package Holiday",
        destination: "Costa Adeje, Tenerife",
        departureAirport: "Birmingham (BHX)",
        dateFrom: "2026-10-24",
        dateTo: "2026-10-31",
        adults: "2",
        children: "2",
        childAges: ["7", "11"],
        budget: "£3,800",
        description: "Family hotel with pool, close to beach.",
        bookingLink: "https://www.jet2holidays.com/",
        agentQuotes: [
          { agent: "Sunseekers Direct", price: "£3,640", rating: "4.6", reviews: "127 reviews", note: "4-star half board", inclusions: ["4-star hotel", "Half board", "Airport transfers"] },
          { agent: "Family Breaks UK", price: "£3,790", rating: "4.9", reviews: "203 reviews", note: "Kids club and transfers", inclusions: ["Kids club", "Family room", "Return transfers"] }
        ]
      },
      {
        id: "QMT-184166",
        createdAt: "2026-05-26T16:05:00.000Z",
        status: "2 of 5 agents quoted",
        quotesReceived: 2,
        maxQuotes: 5,
        title: "New York City Break",
        tourType: "Multi-Centre Trip",
        destination: "New York, USA",
        departureAirport: "Manchester (MAN)",
        dateFrom: "2026-12-04",
        dateTo: "2026-12-09",
        adults: "2",
        children: "0",
        childAges: [],
        budget: "£4,500",
        description: "Central hotel, direct flights preferred.",
        bookingLink: "",
        agentQuotes: [
          { agent: "City Break Pros", price: "£4,280", rating: "4.8", reviews: "166 reviews", note: "Times Square hotel", inclusions: ["Times Square hotel", "Checked baggage", "Resort fees checked"] },
          { agent: "Atlantic Trips", price: "£4,430", rating: "4.7", reviews: "119 reviews", note: "Direct flights, breakfast", inclusions: ["Direct flights", "Breakfast included", "Central Manhattan"] }
        ]
      },
      {
        id: "QMT-184221",
        createdAt: "2026-05-28T08:50:00.000Z",
        status: "Brand new request",
        quotesReceived: 0,
        maxQuotes: 5,
        title: "Lapland Christmas Escape",
        tourType: "Custom Travel",
        destination: "Rovaniemi, Finland",
        departureAirport: "London Stansted (STN)",
        dateFrom: "2026-12-20",
        dateTo: "2026-12-24",
        adults: "2",
        children: "1",
        childAges: ["6"],
        budget: "£5,200",
        description: "Santa visit, snow activities and family lodge.",
        bookingLink: "",
        agentQuotes: []
      }
    ];
  }

  function mergeQuoteRequests(savedRequests, demoRequests) {
    const seen = new Set();
    return [...savedRequests, ...demoRequests].filter((request) => {
      if (!request || seen.has(request.id)) return false;
      seen.add(request.id);
      return true;
    });
  }

  function getDemoQuoteRequests() {
    const email = getCurrentClient()?.email || "person@mail.com";
    const scenarios = {
      "person@mail.com": [
        ["PER-101", "Mediterranean Cruise", "Cruise", "Barcelona, Rome & Greek Islands", "London Gatwick (LGW)", "2026-06-05", "2026-06-15", "4", "0", [], 22500, "Balcony cabin preferred with excursions included.", "", 5, "cruise"],
        ["PER-102", "Tenerife Half-Term Sun", "Package Holiday", "Costa Adeje, Tenerife", "Birmingham (BHX)", "2026-10-24", "2026-10-31", "2", "2", ["7", "11"], 3800, "Family hotel with pool, close to beach.", "https://www.jet2holidays.com/", 2, "family"],
        ["PER-103", "New York City Break", "City Break", "New York, USA", "Manchester (MAN)", "2026-12-04", "2026-12-09", "2", "0", [], 4500, "Central hotel, direct flights preferred.", "", 2, "city"],
        ["PER-104", "Lapland Christmas Escape", "Custom Travel", "Rovaniemi, Finland", "London Stansted (STN)", "2026-12-20", "2026-12-24", "2", "1", ["6"], 5200, "Santa visit, snow activities and family lodge.", "", 0, "snow"]
      ],
      "sarah@mail.com": [
        ["SAR-201", "Maldives Luxury Escape", "Luxury Holiday", "Baa Atoll, Maldives", "London Heathrow (LHR)", "2026-09-10", "2026-09-20", "2", "0", [], 9800, "Water villa, seaplane transfers and premium dining.", "", 5, "luxury"],
        ["SAR-202", "Greece Island Hop", "Beach Holiday", "Santorini & Naxos, Greece", "Bristol (BRS)", "2026-07-03", "2026-07-12", "2", "1", ["9"], 4200, "Boutique hotels and ferry transfers.", "", 2, "beach"],
        ["SAR-203", "Paris Disney Break", "Disney Trip", "Paris, France", "London St Pancras", "2026-08-17", "2026-08-21", "2", "2", ["5", "8"], 3200, "Disney hotel with park tickets included.", "", 2, "family"],
        ["SAR-204", "Dubai Shopping Weekend", "Luxury Holiday", "Dubai, UAE", "Manchester (MAN)", "2026-11-12", "2026-11-16", "2", "0", [], 3600, "Five-star hotel near Dubai Mall.", "", 0, "luxury"]
      ],
      "david@mail.com": [
        ["DAV-301", "Norway Fjords Cruise", "Cruise Holiday", "Norway Fjords", "Southampton", "2026-06-22", "2026-07-01", "2", "0", [], 6400, "Scenic fjord itinerary with balcony cabin.", "", 5, "cruise"],
        ["DAV-302", "Turkey All Inclusive", "Package Holiday", "Antalya, Turkey", "Glasgow (GLA)", "2026-05-18", "2026-05-25", "2", "2", ["10", "13"], 3100, "All inclusive resort with water slides.", "https://www.tui.co.uk/", 2, "family"],
        ["DAV-303", "Iceland Northern Lights", "Adventure Holiday", "Reykjavik, Iceland", "Edinburgh (EDI)", "2026-02-06", "2026-02-10", "2", "0", [], 2900, "Northern lights tour and lagoon visit.", "", 2, "snow"],
        ["DAV-304", "Rome Cultural Weekend", "Cultural Holiday", "Rome, Italy", "London City (LCY)", "2026-04-23", "2026-04-27", "2", "0", [], 2100, "Central hotel and guided Vatican tour.", "", 0, "city"]
      ],
      "emma@mail.com": [
        ["EMM-401", "Mauritius Paradise", "Luxury Holiday", "Belle Mare, Mauritius", "London Gatwick (LGW)", "2026-09-02", "2026-09-12", "2", "0", [], 7900, "Beachfront resort with half board.", "", 5, "luxury"],
        ["EMM-402", "Barcelona City & Beach", "Multi-Centre Trip", "Barcelona, Spain", "Manchester (MAN)", "2026-06-11", "2026-06-18", "2", "0", [], 2600, "City hotel, beach time and tapas tour.", "", 2, "city"],
        ["EMM-403", "Florida Theme Parks", "Package Holiday", "Orlando, USA", "London Heathrow (LHR)", "2026-08-01", "2026-08-15", "2", "2", ["6", "12"], 9200, "Villa or family hotel with park tickets.", "", 2, "family"],
        ["EMM-404", "Malta Family Break", "Beach Holiday", "St Julian's, Malta", "Birmingham (BHX)", "2026-05-26", "2026-06-02", "2", "1", ["4"], 2400, "Short-haul beach break with family room.", "", 0, "beach"]
      ],
      "james@mail.com": [
        ["JAM-501", "Thailand Adventure", "Adventure Holiday", "Bangkok, Chiang Mai & Phuket", "London Heathrow (LHR)", "2026-11-01", "2026-11-14", "2", "0", [], 6200, "Temples, beach stay and guided experiences.", "", 5, "adventure"],
        ["JAM-502", "Caribbean Cruise", "Cruise Holiday", "Barbados & Caribbean Islands", "Manchester (MAN)", "2026-03-08", "2026-03-18", "2", "0", [], 7200, "Fly-cruise with drinks package.", "", 2, "cruise"],
        ["JAM-503", "Amsterdam City Break", "City Break", "Amsterdam, Netherlands", "Leeds Bradford (LBA)", "2026-05-01", "2026-05-04", "2", "0", [], 1450, "Canal district hotel and museum passes.", "", 2, "city"],
        ["JAM-504", "Canary Islands Winter Sun", "Beach Holiday", "Lanzarote, Canary Islands", "Newcastle (NCL)", "2026-01-20", "2026-01-27", "2", "0", [], 2600, "Quiet resort with heated pool.", "", 0, "beach"]
      ],
      "aisha@mail.com": [
        ["AIS-601", "Dubai Family Tour", "Luxury Holiday", "Dubai, UAE", "Manchester (MAN)", "2026-04-01", "2026-04-14", "2", "2", ["8", "12"], 15000, "Family-friendly luxury hotel and Dubai experiences.", "", 5, "luxury"],
        ["AIS-602", "Morocco Riad Escape", "Cultural Holiday", "Marrakech, Morocco", "London Gatwick (LGW)", "2026-10-05", "2026-10-10", "2", "0", [], 2800, "Riad stay, souk tour and desert dinner.", "", 2, "adventure"],
        ["AIS-603", "Swiss Ski Week", "Ski Holiday", "Zermatt, Switzerland", "London Heathrow (LHR)", "2026-02-14", "2026-02-21", "2", "1", ["14"], 6800, "Ski passes, equipment and central chalet.", "", 2, "snow"],
        ["AIS-604", "Bali Honeymoon", "Luxury Holiday", "Ubud & Seminyak, Bali", "London Heathrow (LHR)", "2026-09-21", "2026-10-02", "2", "0", [], 7400, "Private pool villa and wellness experiences.", "", 0, "luxury"]
      ],
      "michael@mail.com": [
        ["MIC-701", "Princess Mediterranean Cruise", "Cruise Holiday", "Italy, Greece & Croatia", "Southampton", "2026-07-18", "2026-07-29", "2", "0", [], 8800, "Premium cruise fare with balcony cabin.", "", 5, "cruise"],
        ["MIC-702", "Portugal Golf Break", "Package Holiday", "Vilamoura, Portugal", "Birmingham (BHX)", "2026-05-09", "2026-05-16", "4", "0", [], 5600, "Golf resort, tee times and transfers.", "", 2, "beach"],
        ["MIC-703", "New York Theatre Trip", "City Break", "New York, USA", "London Heathrow (LHR)", "2026-12-10", "2026-12-15", "2", "0", [], 5200, "Broadway tickets and central hotel.", "", 2, "city"],
        ["MIC-704", "Egypt Nile Adventure", "Adventure Holiday", "Cairo & Nile Cruise, Egypt", "Manchester (MAN)", "2026-03-16", "2026-03-25", "2", "0", [], 4900, "Guided sites, Nile cruise and private transfers.", "", 0, "adventure"]
      ]
    };

    return (scenarios[email] || scenarios["person@mail.com"]).map(createDemoRequest);
  }

  function createDemoRequest(data) {
    const [code, title, tourType, destination, departureAirport, dateFrom, dateTo, adults, children, childAges, budget, description, bookingLink, quotesReceived, quoteTheme] = data;
    return {
      id: `QMT-${code}`,
      createdAt: getDemoDate(code),
      status: quotesReceived ? `${quotesReceived} of 5 agents quoted` : "Brand new request",
      quotesReceived,
      maxQuotes: 5,
      title,
      tourType,
      destination,
      departureAirport,
      dateFrom,
      dateTo,
      adults,
      children,
      childAges,
      budget: formatPounds(budget),
      description,
      bookingLink,
      agentQuotes: buildAgentQuotes(quoteTheme, quotesReceived, budget)
    };
  }

  function buildAgentQuotes(theme, count, budget) {
    const notes = {
      cruise: ["Balcony cabin, drinks package", "Flights and transfers included", "Best value, full board", "Premium cabin upgrade", "Excursion credit included"],
      family: ["Family room and kids club", "Transfers and checked bags", "Half board family hotel", "Water park access", "Flexible family payment"],
      city: ["Central hotel, breakfast", "Direct flights included", "Best value city location", "Premium room upgrade", "Event ticket support"],
      beach: ["Beachfront hotel", "All-inclusive option", "Sea-view room", "Airport transfers", "Low deposit available"],
      luxury: ["Five-star hotel", "Private transfers", "Premium dining plan", "Room upgrade included", "Concierge support"],
      adventure: ["Guided experiences", "Private transfers", "Flexible itinerary", "Excursions included", "Local specialist support"],
      snow: ["Resort transfers", "Activity passes", "Warm family lodge", "Equipment support", "Flexible winter package"]
    };
    const agents = ["Ocean Blue Travel", "Harbour Holidays", "CruiseLine Experts", "Atlas Travel Co", "Voyage Desk"];
    const ratings = ["4.9", "4.7", "4.8", "4.6", "4.5"];
    const reviews = ["312 reviews", "188 reviews", "241 reviews", "96 reviews", "74 reviews"];
    const selectedNotes = notes[theme] || notes.luxury;

    return agents.slice(0, count).map((agent, index) => ({
      agent,
      price: formatPounds(Math.max(950, budget - 560 + (index * 210))),
      rating: ratings[index],
      reviews: reviews[index],
      note: selectedNotes[index],
      inclusions: [selectedNotes[index], "PDF quote available", index % 2 ? "ATOL protected" : "Verified agent support"]
    }));
  }

  function getDemoDate(code) {
    const offset = Number(String(code).replace(/\D/g, "").slice(-1)) || 1;
    return new Date(Date.UTC(2026, 4, 29 - offset, 9 + offset, 20, 0)).toISOString();
  }

  function formatPounds(value) {
    return `\u00a3${Number(value).toLocaleString("en-GB")}`;
  }

  function getQuoteState(request) {
    const max = Math.max(1, Number(request.maxQuotes) || 5);
    const received = Math.min(max, Math.max(0, Number(request.quotesReceived ?? (request.agentQuotes || []).length) || 0));
    const className = received >= max ? "quote-status-complete" : received > 0 ? "quote-status-progress" : "quote-status-new";
    return { received, max, className };
  }

  function getQuoteImage(request) {
    const text = `${request.title || ""} ${request.destination || ""}`.toLowerCase();
    if (text.includes("dubai")) return "/assets/trip-images/dubai-family-tour.png";
    if (text.includes("new york")) return "/assets/trip-images/new-york-city.png";
    if (text.includes("lapland") || text.includes("norway") || text.includes("finland")) return "/assets/trip-images/norway-fjords-cruise.png";
    if (text.includes("tenerife") || text.includes("mauritius") || text.includes("maldives")) return "/assets/trip-images/tropical-resort.png";
    return "/assets/trip-images/mediterranean-cruise.png";
  }

  function loadQuoteRequests() {
    try {
      const currentRequests = JSON.parse(localStorage.getItem(getClientStorageKey("qmtQuoteRequests")) || "[]");
      if (currentRequests.length || getCurrentClient()?.email !== "person@mail.com") return currentRequests;
      return JSON.parse(localStorage.getItem("qmtQuoteRequests") || "[]");
    } catch {
      return [];
    }
  }

  function formatDate(value) {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
