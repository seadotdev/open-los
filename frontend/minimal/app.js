/**
 * Open LOS — Minimal UI
 * Config-driven dashboard connected to the Open LOS API.
 * All rendering is driven by LOS_CONFIG (loaded from config.js).
 */

// ── Globals ──────────────────────────────────────────────────────────

const C = window.LOS_CONFIG;
let pollTimer = null;

// ── API Layer ────────────────────────────────────────────────────────

function apiHeaders() {
    return {
        "Content-Type": "application/json",
        "X-Tenant-Id": C.api.tenantId,
        "X-Actor": C.api.actor,
    };
}

async function apiFetch(path, opts = {}) {
    const url = `${C.api.baseUrl}${path}`;
    try {
        const res = await fetch(url, { headers: apiHeaders(), ...opts });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setConnected(true);
        return res.json();
    } catch (err) {
        setConnected(false);
        console.warn(`API: ${err.message}`);
        return null;
    }
}

function setConnected(ok) {
    const dot = document.getElementById("connection-status");
    dot.classList.toggle("connected", ok);
    dot.title = ok ? "API connected" : "API disconnected";
}

// ── Data Fetchers ────────────────────────────────────────────────────

async function fetchDeals() {
    return apiFetch("/v1/deals") || [];
}

async function fetchAuditEvents(limit = 30) {
    return apiFetch(`/v1/audit-events?limit=${limit}`) || [];
}

async function fetchDocuments() {
    return apiFetch("/v1/documents") || [];
}

// ── Rendering: Apply Config ──────────────────────────────────────────

function applyConfig() {
    // Name
    document.getElementById("app-name").textContent = C.name;
    document.title = C.name;

    // Theme
    if (C.display.theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
    }

    // Default view
    if (C.display.defaultView) {
        switchView(C.display.defaultView);
    }

    // Pipeline columns
    renderPipelineColumns();

    // Pass-through bar
    renderPassThrough();
}

// ── Rendering: Pipeline Board ────────────────────────────────────────

function renderPipelineColumns() {
    const board = document.getElementById("pipeline-board");
    board.style.gridTemplateColumns = `repeat(${C.stages.length}, 1fr)`;
    board.innerHTML = C.stages.map(stage => `
        <div class="pipeline-col" data-stage="${stage.id}">
            <div class="pipeline-col-header">
                <span class="pipeline-col-label">
                    <span class="pipeline-col-dot" style="background:${stage.color}"></span>
                    ${stage.label}
                </span>
                <span class="pipeline-col-count" data-count-for="${stage.id}">0</span>
            </div>
            <div class="pipeline-col-body" data-body-for="${stage.id}"></div>
        </div>
    `).join("");
}

function renderPipelineCards(deals) {
    // Clear all columns
    C.stages.forEach(stage => {
        const body = document.querySelector(`[data-body-for="${stage.id}"]`);
        const count = document.querySelector(`[data-count-for="${stage.id}"]`);
        if (body) body.innerHTML = "";
        if (count) count.textContent = "0";
    });

    if (!deals || !deals.length) {
        // Show demo data
        renderDemoCards();
        return;
    }

    // Map deals to stages
    const stageMap = {};
    C.stages.forEach(s => { stageMap[s.id] = []; });

    deals.forEach(deal => {
        const stageId = mapDealStage(deal.stage);
        if (stageMap[stageId]) stageMap[stageId].push(deal);
    });

    Object.entries(stageMap).forEach(([stageId, stageDeals]) => {
        const body = document.querySelector(`[data-body-for="${stageId}"]`);
        const count = document.querySelector(`[data-count-for="${stageId}"]`);
        if (!body) return;

        count.textContent = stageDeals.length;
        body.innerHTML = stageDeals.map(deal => cardHtml(deal)).join("");
    });

    updateKpis(deals);
}

function cardHtml(deal) {
    const score = deal.confidence || deal.score;
    const scoreClass = score >= 85 ? "high" : score >= 60 ? "medium" : score < 60 && score > 0 ? "low" : "";
    const journey = deal.journey_type || deal.segment || "";
    const journeyLabel = C.journeyTypes.find(j => j.id === journey)?.label || journey;

    return `
        <div class="pipeline-card" data-deal-id="${deal.id}">
            <div class="pipeline-card-id">${deal.id}</div>
            <div class="pipeline-card-name">${deal.borrower_name || deal.name || "Unnamed"}</div>
            <div class="pipeline-card-meta">
                ${journeyLabel ? `<span class="pipeline-card-journey">${journeyLabel}</span>` : ""}
                ${score ? `<span class="pipeline-card-score ${scoreClass}">${score}%</span>` : ""}
            </div>
            ${deal.amount ? `
                <div class="pipeline-card-meta" style="margin-top:4px">
                    <span>${C.currency} ${formatNumber(deal.amount)}</span>
                </div>
            ` : ""}
        </div>
    `;
}

function mapDealStage(stage) {
    // Map Open LOS stage names to config stage IDs
    const mapping = {
        broker: "document_collection",
        origination: "document_collection",
        document_collection: "document_collection",
        underwriting: "analysis",
        analysis: "analysis",
        validation: "validation",
        ai_validation: "validation",
        review: "review",
        closing: "processed",
        monitoring: "processed",
        processed: "processed",
    };
    return mapping[stage] || C.stages[0].id;
}

// ── Rendering: Demo Data ─────────────────────────────────────────────

function renderDemoCards() {
    const demoData = [
        { stage: "document_collection", items: [
            { id: "APP-242422", name: "Al Ahli Bank", journey: "ilc_issuance", amount: 210000, docs: 1 },
            { id: "APP-242430", name: "KIPCO Group", journey: "olg_bulk", amount: 175000, docs: 2 },
        ]},
        { stage: "analysis", items: [
            { id: "APP-242401", name: "Kuwait Petroleum Corp", journey: "ilc_issuance", amount: 125000, score: 91 },
        ]},
        { stage: "validation", items: [
            { id: "APP-242455", name: "Boubyan Petrochemical", journey: "ilc_negotiation", amount: 112500, score: 85 },
        ]},
        { stage: "review", items: [
            { id: "APP-242358", name: "Alghanim Intl Gen Trading", journey: "ilc_issuance", amount: 58500, score: 78 },
            { id: "APP-242445", name: "Burgan Bank", journey: "ilc_issuance", amount: 195000, score: 72 },
        ]},
        { stage: "processed", items: [
            { id: "APP-242380", name: "Agility Logistics", journey: "ilc_negotiation", amount: 88200, score: 94 },
            { id: "APP-242450", name: "NBK Treasury", journey: "olg_bulk", amount: 520000 },
        ]},
    ];

    demoData.forEach(({ stage, items }) => {
        const body = document.querySelector(`[data-body-for="${stage}"]`);
        const count = document.querySelector(`[data-count-for="${stage}"]`);
        if (!body) return;

        count.textContent = items.length;
        body.innerHTML = items.map(item => {
            const journeyLabel = C.journeyTypes.find(j => j.id === item.journey)?.label || "";
            const scoreClass = item.score >= 85 ? "high" : item.score >= 60 ? "medium" : item.score < 60 && item.score > 0 ? "low" : "";
            return `
                <div class="pipeline-card">
                    <div class="pipeline-card-id">${item.id}</div>
                    <div class="pipeline-card-name">${item.name}</div>
                    <div class="pipeline-card-meta">
                        <span class="pipeline-card-journey">${journeyLabel}</span>
                        ${item.score ? `<span class="pipeline-card-score ${scoreClass}">${item.score}%</span>` : ""}
                    </div>
                    <div class="pipeline-card-meta" style="margin-top:4px">
                        <span>${C.currency} ${formatNumber(item.amount)}</span>
                    </div>
                </div>
            `;
        }).join("");
    });

    // Demo KPIs
    document.getElementById("kpi-total").textContent = "14";
    document.getElementById("kpi-pending").textContent = "5";
    document.getElementById("kpi-documents").textContent = "49";
    document.getElementById("kpi-stp").textContent = "67%";

    // Demo decisions
    renderDemoDecisions();

    // Demo activity
    renderDemoActivity();
}

// ── Rendering: Decisions ─────────────────────────────────────────────

function renderDecisions(decisions) {
    const list = document.getElementById("decisions-list");

    if (!decisions || !decisions.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#10003;</div>No pending decisions</div>`;
        updateDecisionsBadge(0);
        return;
    }

    updateDecisionsBadge(decisions.length);
    list.innerHTML = decisions.map(d => decisionCardHtml(d)).join("");
    bindDecisionActions();
}

function decisionCardHtml(d) {
    const showRec = C.display.showAiRecommendations && d.recommendation;
    return `
        <div class="decision-card" data-severity="${d.severity}" data-decision-id="${d.id}">
            <div class="decision-card-indicator ${d.severity}"></div>
            <div class="decision-card-body">
                <div class="decision-card-top">
                    <span class="decision-card-id">${d.caseId || ""} &middot; ${d.journeyType || ""}</span>
                    <span class="decision-card-severity ${d.severity}">${d.severity}</span>
                </div>
                <div class="decision-card-title">${d.title}</div>
                <div class="decision-card-subtitle">${d.applicant || ""} ${d.amount ? `&middot; ${C.currency} ${formatNumber(d.amount)}` : ""}</div>
                <div class="decision-card-description">${d.description}</div>
                ${showRec ? `
                    <div class="decision-card-recommendation">
                        <div class="recommendation-label">Agent Recommendation</div>
                        <div class="recommendation-text">${d.recommendation}</div>
                    </div>
                ` : ""}
                <div class="decision-card-actions">
                    <button class="btn approve" data-action="approve">Approve</button>
                    <button class="btn" data-action="request_info">Request Info</button>
                    <button class="btn decline" data-action="decline">Decline</button>
                    <button class="btn primary" data-action="ai_assess">AI Assess</button>
                </div>
            </div>
        </div>
    `;
}

function renderDemoDecisions() {
    const demoDecisions = [
        {
            id: "d1", caseId: "APP-242358", journeyType: "ILC Issuance",
            severity: "high", title: "EDD Flag — Senior Compliance Sign-off Required",
            applicant: "Alghanim Intl Gen Trading", amount: 58500,
            description: "Beneficiary bank (Commercial Bank of Kuwait) recently added to enhanced due diligence monitoring list. Senior compliance sign-off required.",
            recommendation: "Approve with EDD conditions — transaction appears legitimate (glass wool for construction), beneficiary has clean history. Recommend 90-day enhanced monitoring.",
        },
        {
            id: "d2", caseId: "APP-242358", journeyType: "ILC Issuance",
            severity: "medium", title: "Port Location Discrepancy",
            applicant: "Alghanim Intl Gen Trading", amount: 58500,
            description: "Minor port location variant: \"Shuaiba Warehouse\" vs \"Shuaiba Industrial Area\" in LC application. Both refer to the same logistics zone.",
            recommendation: "Accept under UCP 600 Art. 14 (d) — non-material discrepancy. Both locations in Shuaiba Industrial Zone. Request applicant confirmation letter.",
        },
        {
            id: "d3", caseId: "APP-242415", journeyType: "OLG Bulk",
            severity: "medium", title: "Cross-Validation Pending",
            applicant: "Zain Telecom Kuwait", amount: 340000,
            description: "OLG bulk application for KWD 340,000 — 3 guarantee instruments. Cross-validation in progress, 2 of 3 checks passed.",
            recommendation: "Hold until cross-validation completes. Preliminary scoring suggests Tier 1 — likely auto-approve eligible.",
        },
        {
            id: "d4", caseId: "APP-242445", journeyType: "ILC Issuance",
            severity: "medium", title: "Facility Utilisation Soft Limit Exceeded",
            applicant: "Burgan Bank", amount: 195000,
            description: "Credit facility utilisation would reach 88% post-issuance (KWD 195,000). Exceeds 85% soft limit threshold — requires senior credit officer override.",
            recommendation: "Approve with conditions — applicant has strong payment history, facility headroom request submitted. Suggest temporary limit increase pending Q2 review.",
        },
        {
            id: "d5", caseId: "APP-242470", journeyType: "ILC Issuance",
            severity: "low", title: "Insurance Coverage Gap",
            applicant: "Mabanee Company", amount: 155000,
            description: "Insurance certificate uploaded but coverage period starts 15 days after shipment date. Gap in transit coverage identified.",
            recommendation: "Request updated insurance certificate with coverage effective from shipment date. Low risk — applicant has historically complied within 24 hours.",
        },
    ];

    renderDecisions(demoDecisions);
}

// ── Rendering: Activity Feed ─────────────────────────────────────────

function renderActivity(events) {
    const feed = document.getElementById("activity-feed");

    if (!events || !events.length) {
        feed.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&#9711;</div>No activity yet</div>`;
        return;
    }

    feed.innerHTML = events.map(e => activityItemHtml(e)).join("");
    bindActivityFilters();
}

function activityItemHtml(e) {
    const dotClass = e.source || (e.actor?.startsWith("ai") ? "ai" : "human");
    return `
        <div class="activity-item" data-source="${dotClass}">
            <div class="activity-dot ${e.dotClass || dotClass}"></div>
            <div class="activity-content">
                <div class="activity-text">${e.text}</div>
                <div class="activity-meta">
                    ${e.caseId ? `<span class="activity-tag">${e.caseId}</span>` : ""}
                    ${e.journeyType ? `<span class="activity-tag">${e.journeyType}</span>` : ""}
                    <span>${e.time || ""}</span>
                </div>
                ${e.justification ? `<div class="activity-justification">${e.justification}</div>` : ""}
            </div>
        </div>
    `;
}

function renderDemoActivity() {
    const events = [
        { text: "Beneficiary bank (COMBKWKW) flagged in EDD list — escalated for senior compliance sign-off", source: "ai", dotClass: "warning", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:42" },
        { text: "EDD stipulation approved for APP-242358 — transaction deemed legitimate with monitoring", source: "human", dotClass: "success", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:44", justification: "Reviewed beneficiary history — no adverse findings. Approved with 90-day enhanced monitoring condition." },
        { text: "Credit scoring completed — Tier 2, score 78%. DSCR pass, LTV within limits.", source: "ai", dotClass: "ai", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:38" },
        { text: "Credit memo generated — 4 risks identified, 2 mitigants", source: "ai", dotClass: "ai", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:35" },
        { text: "Port discrepancy: \"Shuaiba Warehouse\" vs \"Shuaiba Industrial Area\"", source: "ai", dotClass: "warning", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:32" },
        { text: "Port discrepancy overridden — locations confirmed as same logistics zone", source: "human", dotClass: "success", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:33", justification: "Both \"Shuaiba Warehouse\" and \"Shuaiba Industrial Area\" refer to the same zone. Confirmed with applicant." },
        { text: "218 fields extracted from 4 documents — confidence avg 94%", source: "ai", dotClass: "success", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:28" },
        { text: "KYC_Alghanim_CIF-00918472.pdf ingested from core banking integration", source: "ai", dotClass: "ai", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:24" },
        { text: "ProForma_Invoice_PFI-54151.pdf uploaded by operations", source: "human", dotClass: "human", caseId: "APP-242358", journeyType: "ILC Issuance", time: "11:22" },
        { text: "Credit scoring completed — Tier 1, score 91%. All metrics pass.", source: "ai", dotClass: "success", caseId: "APP-242401", journeyType: "ILC Issuance", time: "11:15" },
    ];

    renderActivity(events);
}

// ── KPIs ──────────────────────────────────────────────────────────────

function updateKpis(deals) {
    if (!deals) return;
    const total = deals.length;
    const reviewStage = C.stages.find(s => s.id === "review");
    const pending = reviewStage ? deals.filter(d => mapDealStage(d.stage) === "review").length : 0;
    const processed = deals.filter(d => mapDealStage(d.stage) === "processed").length;
    const stpRate = total > 0 ? Math.round((processed / total) * 100) : 0;

    document.getElementById("kpi-total").textContent = total;
    document.getElementById("kpi-pending").textContent = pending;
    document.getElementById("kpi-stp").textContent = `${stpRate}%`;
}

function updateDecisionsBadge(count) {
    const badge = document.getElementById("decisions-badge");
    badge.textContent = count;
    badge.hidden = count === 0;
}

// ── Pass-Through Bar ──────────────────────────────────────────────────

function renderPassThrough() {
    const bar = document.getElementById("passthrough-bar");
    const ruleCount = document.getElementById("passthrough-rule-count");

    if (!C.passThrough.enabled) {
        bar.classList.add("disabled");
        bar.querySelector(".passthrough-header span:nth-child(2)").textContent = "Pass-through disabled";
    }

    ruleCount.textContent = `${C.passThrough.rules.length} rules`;
}

// ── View Switching ────────────────────────────────────────────────────

function switchView(viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

    const view = document.getElementById(`view-${viewId}`);
    const btn = document.querySelector(`[data-view="${viewId}"]`);
    if (view) view.classList.add("active");
    if (btn) btn.classList.add("active");
}

// ── AI Panel ──────────────────────────────────────────────────────────

function toggleAiPanel() {
    const panel = document.getElementById("ai-panel");
    const toggle = document.getElementById("ai-toggle");
    panel.classList.toggle("open");
    toggle.classList.toggle("active");
    if (panel.classList.contains("open")) {
        document.getElementById("ai-input").focus();
    }
}

function addAiMessage(text, type = "assistant") {
    const container = document.getElementById("ai-messages");
    const msg = document.createElement("div");
    msg.className = `ai-msg ${type}`;
    msg.innerHTML = `<p>${text}</p>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function handleAiSend() {
    const input = document.getElementById("ai-input");
    const text = input.value.trim();
    if (!text) return;

    addAiMessage(text, "user");
    input.value = "";

    // Try to hit the chat API, fall back to mock
    sendAiChat(text);
}

async function sendAiChat(text) {
    const result = await apiFetch("/v1/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
    });

    if (result && result.response) {
        addAiMessage(result.response, "assistant");
    } else {
        // Mock response
        const responses = [
            `Based on the current pipeline, you have cases across ${C.stages.length} stages. ${C.passThrough.enabled ? "Pass-through is active with " + C.passThrough.rules.length + " rules." : "Pass-through is disabled."}`,
            `The ${C.industry} dashboard is configured with ${C.documentTypes.length} document types and ${C.decisionCriteria.length} decision criteria.`,
            `Review triggers are set for: ${C.reviewTriggers.map(t => t.label).join(", ")}. Cases not matching any trigger will ${C.passThrough.enabled ? "pass through automatically" : "queue for manual review"}.`,
            `I can help you review any case in the pipeline. Click on a card in the Dashboard view, or ask me about a specific application ID.`,
        ];
        addAiMessage(responses[Math.floor(Math.random() * responses.length)], "assistant");
    }
}

// ── Decision Actions ──────────────────────────────────────────────────

function bindDecisionActions() {
    document.querySelectorAll(".decision-card-actions .btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const card = btn.closest(".decision-card");
            const id = card.dataset.decisionId;

            const originalText = btn.textContent;
            btn.textContent = "Processing…";
            btn.disabled = true;

            setTimeout(() => {
                if (action === "approve") {
                    btn.textContent = "Approved";
                    btn.className = "btn approve";
                    card.style.opacity = "0.5";
                } else if (action === "decline") {
                    btn.textContent = "Declined";
                    card.style.opacity = "0.5";
                } else {
                    btn.textContent = originalText;
                }
                btn.disabled = false;
            }, 600);
        });
    });
}

// ── Activity Filters ──────────────────────────────────────────────────

function bindActivityFilters() {
    document.querySelectorAll(".activity-filters .filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll(".activity-filters .filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const source = pill.dataset.source;
            document.querySelectorAll(".activity-item").forEach(item => {
                item.style.display = source === "all" || item.dataset.source === source ? "flex" : "none";
            });
        });
    });
}

// ── Severity Filters ──────────────────────────────────────────────────

function bindSeverityFilters() {
    document.querySelectorAll("#severity-filters .filter-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll("#severity-filters .filter-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const severity = pill.dataset.severity;
            document.querySelectorAll(".decision-card").forEach(card => {
                card.style.display = severity === "all" || card.dataset.severity === severity ? "block" : "none";
            });
        });
    });
}

// ── Data Refresh ──────────────────────────────────────────────────────

async function refreshData() {
    const deals = await fetchDeals();
    if (deals) {
        renderPipelineCards(deals);
    } else {
        // Use demo data when API is unavailable
        renderDemoCards();
    }
}

function startPolling() {
    if (C.api.pollIntervalMs > 0) {
        pollTimer = setInterval(refreshData, C.api.pollIntervalMs);
    }
}

// ── Utilities ─────────────────────────────────────────────────────────

function formatNumber(n) {
    if (n == null) return "--";
    return new Intl.NumberFormat(C.locale).format(n);
}

// ── Event Bindings ────────────────────────────────────────────────────

function bindEvents() {
    // Navigation
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    // AI panel
    document.getElementById("ai-toggle").addEventListener("click", toggleAiPanel);
    document.getElementById("ai-close").addEventListener("click", toggleAiPanel);
    document.getElementById("ai-send").addEventListener("click", handleAiSend);
    document.getElementById("ai-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleAiSend();
    });

    // Severity filters
    bindSeverityFilters();

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            toggleAiPanel();
        }
        if (e.key === "Escape" && document.getElementById("ai-panel").classList.contains("open")) {
            toggleAiPanel();
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    applyConfig();
    bindEvents();
    refreshData();
    startPolling();

    console.log(`${C.name} initialized`);
    console.log(`Industry: ${C.industry}`);
    console.log(`Stages: ${C.stages.map(s => s.label).join(" → ")}`);
    console.log(`Review triggers: ${C.reviewTriggers.length}`);
    console.log(`Pass-through: ${C.passThrough.enabled ? "ON" : "OFF"} (${C.passThrough.rules.length} rules)`);
    console.log("Press Ctrl+K to open AI assistant");
});
