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

    if (action === "accept-quote" || action === "reject-quote") {
      setQuoteDecision(requestId, agent, action === "accept-quote" ? "accepted" : "rejected");
      expandedQuoteRequests.add(requestId);
      renderDashboardRequests();
      return;
    }

    if (action === "retrieve-pdf") {
      const request = getDashboardRequests().find((item) => item.id === requestId);
      const quote = request && Array.isArray(request.agentQuotes)
        ? request.agentQuotes.find((item) => item.agent === agent)
        : null;
      if (request && quote) downloadQuotePdf(request, quote);
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

  function downloadQuotePdf(request, quote) {
    const lines = [
      "Agent Quote PDF",
      `Request: ${request.id}`,
      `Holiday: ${request.title}`,
      `Destination: ${request.destination}`,
      `Agent: ${quote.agent}`,
      `Rating: ${quote.rating || "4.7"} out of 5`,
      `Price: ${quote.price}`,
      `Summary: ${quote.note}`,
      `Dates: ${formatDate(request.dateFrom)} - ${formatDate(request.dateTo)}`,
      `Passengers: ${request.adults} adults, ${request.children || 0} children`,
      `Budget: ${request.budget}`,
      "",
      "This is a prototype PDF quote for market research testing."
    ];
    const pdf = buildSimplePdf(lines);
    const blob = new Blob([pdf], { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(request.id)}-${slugify(quote.agent)}-quote.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
  }

  function buildSimplePdf(lines) {
    const contentLines = ["BT", "/F1 18 Tf", "50 760 Td", `(${escapePdfText(lines[0])}) Tj`, "/F1 11 Tf"];
    lines.slice(1).forEach((line) => {
      contentLines.push("0 -20 Td", `(${escapePdfText(line)}) Tj`);
    });
    contentLines.push("ET");
    const stream = contentLines.join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
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

  function escapePdfText(value) {
    return String(value ?? "")
      .replaceAll("£", "GBP ")
      .replaceAll("\u00a3", "GBP ")
      .replace(/[^\x20-\x7e]/g, "")
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");
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
      formNode.elements.password.value = DEMO_PASSWORD;
    } else {
      formNode.elements.email.value = "person@mail.com";
      formNode.elements.password.value = DEMO_PASSWORD;
    }

    formNode.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = formNode.elements.email.value.trim().toLowerCase();
      const password = formNode.elements.password.value.trim();
      const client = DEMO_CLIENTS.find((item) => item.email === email);

      if (!client || password !== DEMO_PASSWORD) {
        if (errorNode) errorNode.textContent = "Use one of the demo client emails and password 12345.";
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
