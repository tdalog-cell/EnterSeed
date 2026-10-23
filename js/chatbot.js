/** Source-traced AI assistant and local-only business document generator. */
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatMessages = document.querySelector("#chat-messages");
const aiStatus = document.querySelector("#ai-status");
const aiMode = document.querySelector("#ai-mode");
const sourceList = document.querySelector("#source-list");
const conversation = [];
const localSources = [
  { label: "DTI Business Name Registration System", url: "https://bnrs.dti.gov.ph/", lastLinkChecked: "2026-10-19", reviewNote: "Official portal; automated access was rate-limited. Confirm current requirements and fees directly." },
  { label: "DTI business-name registration FAQ", url: "https://www.dti.gov.ph/resources/faq/business-name-registration/", lastLinkChecked: "2026-10-19", reviewNote: "Official DTI page; content could not be independently fetched during this review." },
  { label: "South Cotabato Provincial Government services", url: "https://southcotabato.gov.ph/services/", lastLinkChecked: "2026-10-19", reviewNote: "Official provincial website; confirm the relevant office and current process directly." },
  { label: "Koronadal City Government", url: "https://koronadal.gov.ph/", lastLinkChecked: "2026-10-19", reviewNote: "Official city website; permit-specific details were not independently confirmed." }
];
const offlineAnswers = [
  { match: /dti|business name|registration|bnrs|rehistro|pagpaparehistro/i, text: "I can help you get oriented, but I cannot confirm current DTI requirements from this demo. Use the official BNRS portal below to check current requirements and fees. Local permits are separate; ask your city or municipal office which rules apply to your business.", fil: "Makakatulong ako sa paunang gabay, pero hindi ko makukumpirma rito ang kasalukuyang mga kinakailangan ng DTI. Tingnan ang opisyal na BNRS portal sa ibaba para sa pinakabagong mga kinakailangan at bayarin. Hiwalay ang mga lokal na permit; magtanong sa tanggapan ng inyong lungsod o munisipalidad kung ano ang naaangkop sa negosyo mo." },
  { match: /permit|lgu|barangay|municipal|city|pahintulot|munisipalidad|lungsod/i, text: "Permit requirements depend on your business activity and location. Contact your city or municipal business-permit office for its current checklist. The links below are starting points, not confirmation that specific permit rules were reviewed.", fil: "Nakadepende sa uri at lokasyon ng negosyo ang mga kinakailangang permit. Makipag-ugnayan sa tanggapan ng permit sa negosyo ng inyong lungsod o munisipalidad para sa kasalukuyang checklist. Panimulang sanggunian lamang ang mga link sa ibaba at hindi kumpirmasyon ng partikular na patakaran." },
  { match: /feasibility|land bank|loan|business plan|pag-aaral|pautang|plano ng negosyo/i, text: "A feasibility-study draft can organize the market, operations, startup costs, financial assumptions, and risks. Treat projections as your own assumptions, and ask your Land Bank lending officer for the current loan product checklist. This is not lending advice or a loan approval.", fil: "Makakatulong ang burador ng feasibility study sa pag-aayos ng impormasyon tungkol sa merkado, operasyon, panimulang gastos, palagay sa pananalapi, at mga panganib. Ituring na sarili mong palagay ang mga proyeksiyon at hingin sa opisyal ng Land Bank ang kasalukuyang checklist ng pautang. Hindi ito pag-apruba ng pautang o payo sa pagpapautang." },
  { match: /supplier|raw material|packaging|local|tagapagtustos|materyales/i, text: "The public supplier directory includes only businesses that opted in and passed Enterseed’s documented review. If no results are available, submit a listing application or contact Enterseed support for help.", fil: "Kasama lamang sa pampublikong direktoryo ng supplier ang mga negosyong kusang sumali at pumasa sa pagsusuri ng Enterseed. Kung walang resulta, magsumite ng aplikasyon sa listahan o makipag-ugnayan sa suporta ng Enterseed." }
];
function getOfflineAnswer(question, language) {
  const answer = offlineAnswers.find((entry) => entry.match.test(question));
  if (language === "fil") {
    return answer?.fil
      ?? "Hindi ko makukumpirma ang sagot gamit ang mga sangguniang mayroon ako. Tingnan ang mga opisyal na link sa ibaba o makipag-ugnayan sa suporta ng Enterseed.";
  }
  return answer?.text
    ?? "I can’t verify that answer right now. Check the official links below or contact Enterseed support for a human response.";
}

/** Append text as a message and scroll the conversation viewport. */
function appendMessage(text, sender) {
  const message = document.createElement("div");
  message.className = `chat-message ${sender === "user" ? "user-message" : "assistant-message"}`;
  if (sender === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "e";
    message.append(avatar);
  }
  const bubble = document.createElement("p");
  bubble.textContent = text;
  message.append(bubble);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

/** Reveal offline responses progressively without dropping any response characters. */
async function streamText(target, text) {
  for (const chunk of text.match(/[\s\S]{1,16}/g) || [text]) {
    target.textContent += chunk;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    await new Promise((resolve) => window.setTimeout(resolve, 14));
  }
}

/** Render source links and honest link-review limitations returned by the API. */
function renderSources(sources = localSources) {
  if (!sourceList) return;
  sourceList.replaceChildren();
  sources.forEach((source) => {
    const item = document.createElement("article");
    item.className = "source-item";
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${source.label} ↗`;
    const note = document.createElement("p");
    note.textContent = `Link checked ${source.lastLinkChecked}. ${source.reviewNote}`;
    item.append(link, note);
    sourceList.append(item);
  });
}

/** Ask the same-origin API; browser code never contains or transmits a provider key. */
async function requestAnswer(question, language) {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ question, history: conversation.slice(-8), language }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("The assistant service is not available right now.");
  return response.json();
}

/** Ask Gemini through the server or give a clearly labeled local fallback. */
async function answerQuestion(question) {
  const language = window.EnterseedLanguage?.current === "fil" ? "fil" : "en";
  const typing = document.createElement("div");
  typing.className = "chat-message assistant-message";
  typing.setAttribute("role", "status");
  typing.textContent = language === "fil" ? "Sinusuri ang mga sanggunian…" : "Checking the available references…";
  chatMessages.append(typing);
  let result;
  try {
    result = await requestAnswer(question, language);
  } catch {
    result = {
      answer: getOfflineAnswer(question, language),
      mode: "offline-local",
      sources: localSources
    };
  }
  typing.remove();
  renderSources(result.sources);
  const bubble = appendMessage("", "assistant");
  await streamText(bubble, result.answer);
  const modeLabel = language === "fil"
    ? (result.mode === "gemini" ? "Gemini sa server ng Enterseed" : "Offline na gabay mula sa mga sanggunian")
    : (result.mode === "gemini" ? "Gemini via Enterseed server" : "Offline source-guided fallback");
  if (aiMode) aiMode.textContent = modeLabel;
  if (aiStatus) aiStatus.textContent = language === "fil"
    ? "Nasa ibaba ang mga link sa opisyal na sanggunian at tala ng pagsusuri. Hindi opisyal na pasya ang mga mungkahi ng AI; makipag-ugnayan sa suporta ng Enterseed kung kailangan mo ng kausap."
    : "Official-source links and review notes are shown below. AI suggestions are not official determinations; contact Enterseed support if you need a person.";
  conversation.push({ role: "user", text: question }, { role: "model", text: result.answer });
  if (conversation.length > 8) conversation.splice(0, conversation.length - 8);
}

/** Accept a typed question or a suggested prompt without page navigation. */
function submitQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || !chatMessages) return;
  appendMessage(cleanQuestion, "user");
  void answerQuestion(cleanQuestion);
}

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitQuestion(chatInput.value);
  chatInput.value = "";
  chatInput.focus();
});
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => submitQuestion(button.dataset.prompt)));

/** Escape submitted business details before rendering the local document outline. */
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

/** Build a lender-conversation outline locally; this draft is not sent to any server. */
function buildDocumentMarkup(data) {
  const title = data.documentType === "business-plan" ? "Business Plan" : "Feasibility Study";
  const sections = [
    ["1. Executive summary", "Describe the business opportunity, proposed product or service, and funding objective."],
    ["2. Business and product", `Business: ${data.businessName}. Product or service: ${data.description}.`],
    ["3. Market and customers", "Identify target customers, their needs, local demand, competitors, and the evidence supporting your assumptions."],
    ["4. Location and operations", `Proposed municipality: ${data.location}. Explain suppliers, staffing, production or service delivery, and operating requirements.`],
    ["5. Startup costs and funding", `Initial capital estimate: PHP ${Number(data.capital).toLocaleString("en-PH")}. Attach quotations and explain the proposed use of funds.`],
    ["6. Sales and financial assumptions", "Document prices, expected sales volume, operating costs, cash flow, break-even assumptions, and repayment capacity."],
    ["7. Risks and next steps", "List key risks, mitigation plans, supporting documents, and questions for your lender or adviser."]
  ];
  return `<h2>${title}: ${escapeHtml(data.businessName)}</h2><p><strong>Location:</strong> ${escapeHtml(data.location)} · <strong>Prepared:</strong> ${new Date().toLocaleDateString("en-PH")}</p><p class="document-warning">Working draft only. Confirm current lender requirements and replace every assumption with verified business information.</p>${sections.map(([heading, text]) => `<section><h3>${heading}</h3><p>${escapeHtml(text)}</p></section>`).join("")}<h3>Lender discussion checklist</h3><ul><li>Confirm current loan eligibility and required forms directly with the lender.</li><li>Request the current document checklist from your lending officer.</li><li>Validate projections and attach supporting records or supplier quotations.</li></ul>`;
}

const documentForm = document.querySelector("#document-form");
const documentOutput = document.querySelector("#document-output");
const previewActions = document.querySelector("#preview-actions");
let latestDocument = "";
documentForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!documentForm.reportValidity()) return;
  latestDocument = buildDocumentMarkup(Object.fromEntries(new FormData(documentForm)));
  documentOutput.innerHTML = latestDocument;
  previewActions.hidden = false;
});

/** Download the generated outline as a standalone HTML file. */
document.querySelector("#download-document")?.addEventListener("click", () => {
  if (!latestDocument) return;
  const blob = new Blob([`<!doctype html><meta charset="utf-8"><title>Enterseed business document</title><style>body{max-width:800px;margin:40px auto;font:16px/1.6 sans-serif;color:#26382E}h2,h3{color:#174D3A}.document-warning{padding:12px;background:#F7F5EC}</style>${latestDocument}`], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: "enterseed-business-plan-outline.html" });
  link.click();
  URL.revokeObjectURL(url);
});

/** Open a print view so the visitor can save the generated outline as PDF. */
document.querySelector("#print-document")?.addEventListener("click", () => {
  if (!latestDocument) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><meta charset="utf-8"><title>Enterseed document outline</title><style>body{max-width:800px;margin:40px auto;font:16px/1.6 sans-serif;color:#26382E}h2,h3{color:#174D3A}.document-warning{padding:12px;background:#F7F5EC}</style>${latestDocument}`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
});
