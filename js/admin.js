/** In-memory authenticated supplier review queue for Enterseed staff. */
const authForm = document.querySelector("#admin-auth");
const adminKeyInput = document.querySelector("#admin-key");
const adminStatus = document.querySelector("#admin-status");
const reviewContent = document.querySelector("#review-content");
const pendingList = document.querySelector("#pending-list");
const activeList = document.querySelector("#active-list");
const inquiryList = document.querySelector("#inquiry-list");
let adminKey = "";

/** Send same-origin reviewer API requests with an in-memory bearer token. */
async function adminRequest(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: { Authorization: `Bearer ${adminKey}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Review request failed.");
  return data;
}

/** Render a private supplier application using text nodes, never trusted HTML. */
function buildApplicationCard(application) {
  const card = document.createElement("article");
  card.className = "review-card";
  const title = document.createElement("h3");
  title.textContent = application.businessName;
  const details = document.createElement("p");
  details.className = "review-private-details";
  details.textContent = `${application.category.replaceAll("-", " ")} · ${application.location} · Applicant: ${application.contactName} (${application.contactEmail})`;
  const products = document.createElement("p");
  products.textContent = application.products;
  const website = document.createElement("p");
  website.textContent = application.website ? `Website: ${application.website}` : "No business website supplied.";
  const publicContact = document.createElement("p");
  publicContact.textContent = application.publishContact
    ? `Requested public contact: ${application.publicEmail || application.publicPhone}`
    : "No public contact details requested; use Enterseed introductions.";
  const checklist = document.createElement("fieldset");
  checklist.className = "review-checklist";
  const legend = document.createElement("legend");
  legend.textContent = "Confirm before approval";
  checklist.append(legend);
  const checks = [
    ["identityConfirmed", "Applicant identity checked"],
    ["businessEvidenceReviewed", "Business evidence received and reviewed"],
    ["contactConfirmed", "Private contact details confirmed"],
    ["locationConfirmed", "Business location confirmed"],
    ["listingConsentConfirmed", "Explicit public listing consent confirmed"]
  ];
  checks.forEach(([name, labelText]) => {
    const label = document.createElement("label");
    label.className = "review-check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.required = true;
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(input, text);
    checklist.append(label);
  });
  const notesLabel = document.createElement("label");
  notesLabel.className = "field-label";
  notesLabel.textContent = "Review notes (minimum 20 characters)";
  const notes = document.createElement("textarea");
  notes.name = "reviewNotes";
  notes.minLength = 20;
  notes.maxLength = 1000;
  notes.required = true;
  notes.rows = 3;
  notesLabel.append(notes);
  const actions = document.createElement("div");
  actions.className = "review-actions";
  const approve = document.createElement("button");
  approve.className = "button button-dark";
  approve.type = "submit";
  approve.dataset.action = "approve";
  approve.textContent = "Approve after checks";
  const reject = document.createElement("button");
  reject.className = "button button-outline";
  reject.type = "button";
  reject.dataset.action = "reject";
  reject.textContent = "Reject application";
  actions.append(approve, reject);
  const status = document.createElement("p");
  status.className = "form-status";
  status.setAttribute("role", "status");
  const form = document.createElement("form");
  form.append(title, details, products, website, publicContact, checklist, notesLabel, actions, status);
  form.addEventListener("submit", (event) => void decideApplication(event, application, form, status));
  reject.addEventListener("click", () => void rejectApplication(application, form, status));
  card.append(form);
  return card;
}

/** Persist a decision only after each verification control is checked. */
async function decideApplication(event, application, form, status) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const formData = new FormData(form);
  const checks = Object.fromEntries(["identityConfirmed", "businessEvidenceReviewed", "contactConfirmed", "locationConfirmed", "listingConsentConfirmed"].map((name) => [name, formData.get(name) === "on"]));
  checks.reviewNotes = formData.get("reviewNotes");
  const button = form.querySelector('[data-action="approve"]');
  button.disabled = true;
  try {
    await adminRequest(`/api/admin/supplier-applications/${application.id}/approve`, { method: "POST", body: JSON.stringify(checks) });
    status.textContent = "Approved. The listing is public until its one-year review expiry.";
    status.classList.add("is-success");
    window.setTimeout(() => void loadQueues(), 500);
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("is-error");
  } finally {
    button.disabled = false;
  }
}

/** Reject an application with reviewer-provided notes for the audit record. */
async function rejectApplication(application, form, status) {
  const reason = form.elements.reviewNotes.value.trim();
  if (reason.length < 10) {
    form.elements.reviewNotes.setCustomValidity("Enter a reason of at least 10 characters before rejecting.");
    form.elements.reviewNotes.reportValidity();
    form.elements.reviewNotes.addEventListener("input", () => form.elements.reviewNotes.setCustomValidity(""), { once: true });
    return;
  }
  try {
    await adminRequest(`/api/admin/supplier-applications/${application.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
    status.textContent = "Application rejected and retained under the rejection retention policy.";
    status.classList.add("is-success");
    window.setTimeout(() => void loadQueues(), 500);
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("is-error");
  }
}

/** Render current approved listings and allow consent withdrawal with data removal. */
function buildActiveListing(supplier) {
  const item = document.createElement("article");
  item.className = "review-card active-review-card";
  const title = document.createElement("h3");
  title.textContent = supplier.businessName;
  const details = document.createElement("p");
  details.textContent = `${supplier.location} · ${supplier.category.replaceAll("-", " ")} · ${supplier.status}`;
  const expiry = document.createElement("p");
  const expired = new Date(supplier.expiresAt) < new Date();
  expiry.textContent = `Verification ${expired ? "expired" : "expires"}: ${new Date(supplier.expiresAt).toLocaleDateString()}`;
  const button = document.createElement("button");
  button.className = "button button-outline";
  button.type = "button";
  button.textContent = "Withdraw listing and erase contacts";
  button.disabled = supplier.status !== "active";
  button.addEventListener("click", async () => {
    if (!window.confirm(`Withdraw ${supplier.businessName} and erase its contact details?`)) return;
    button.disabled = true;
    try {
      await adminRequest(`/api/admin/suppliers/${supplier.id}/withdraw`, { method: "POST" });
      await loadQueues();
    } catch (error) {
      adminStatus.textContent = error.message;
      adminStatus.classList.add("is-error");
      button.disabled = false;
    }
  });
  const erase = document.createElement("button");
  erase.className = "button button-outline";
  erase.type = "button";
  erase.textContent = "Permanently erase supplier record";
  erase.addEventListener("click", async () => {
    if (!window.confirm(`Permanently delete ${supplier.businessName} and its application record?`)) return;
    erase.disabled = true;
    try {
      await adminRequest(`/api/admin/suppliers/${supplier.id}`, { method: "DELETE" });
      await loadQueues();
    } catch (error) {
      adminStatus.textContent = error.message;
      adminStatus.classList.add("is-error");
      erase.disabled = false;
    }
  });
  item.append(title, details, expiry, button, erase);
  return item;
}

/** Render contact requests for human response and allow immediate deletion. */
function buildInquiryCard(inquiry) {
  const card = document.createElement("article");
  card.className = "review-card";
  const title = document.createElement("h3");
  title.textContent = inquiry.topic;
  const sender = document.createElement("p");
  sender.textContent = `${inquiry.name} · ${inquiry.email} · ${new Date(inquiry.createdAt).toLocaleString()}`;
  const message = document.createElement("p");
  message.className = "review-inquiry-message";
  message.textContent = inquiry.message;
  const actions = document.createElement("div");
  actions.className = "review-actions";
  const reply = document.createElement("a");
  reply.className = "button button-dark";
  reply.href = `mailto:${inquiry.email}?subject=${encodeURIComponent(`Enterseed: ${inquiry.topic}`)}`;
  reply.textContent = "Reply by email";
  const remove = document.createElement("button");
  remove.className = "button button-outline";
  remove.type = "button";
  remove.textContent = "Delete inquiry";
  remove.addEventListener("click", async () => {
    try {
      await adminRequest(`/api/admin/inquiries/${inquiry.id}`, { method: "DELETE" });
      await loadQueues();
    } catch (error) {
      adminStatus.textContent = error.message;
      adminStatus.classList.add("is-error");
    }
  });
  actions.append(reply, remove);
  card.append(title, sender, message, actions);
  return card;
}

/** Refresh private pending submissions and the public-listing review dates. */
async function loadQueues() {
  adminStatus.textContent = "Loading review queue…";
  adminStatus.classList.remove("is-error");
  try {
    const [applications, active, inquiries] = await Promise.all([
      adminRequest("/api/admin/supplier-applications"),
      adminRequest("/api/admin/suppliers"),
      adminRequest("/api/admin/inquiries")
    ]);
    pendingList.replaceChildren();
    activeList.replaceChildren();
    if (!applications.applications.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No supplier applications are waiting for review.";
      pendingList.append(empty);
    } else applications.applications.forEach((application) => pendingList.append(buildApplicationCard(application)));
    if (!active.suppliers.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No supplier records are published.";
      activeList.append(empty);
    } else active.suppliers.forEach((supplier) => activeList.append(buildActiveListing(supplier)));
    inquiryList.replaceChildren();
    if (!inquiries.inquiries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No support inquiries are waiting for a reply.";
      inquiryList.append(empty);
    } else inquiries.inquiries.forEach((inquiry) => inquiryList.append(buildInquiryCard(inquiry)));
    reviewContent.hidden = false;
    adminStatus.textContent = "Authenticated. Review evidence and consent before approving any listing.";
  } catch (error) {
    reviewContent.hidden = true;
    adminStatus.textContent = error.message;
    adminStatus.classList.add("is-error");
  }
}

/** Keep the bearer key only in memory for this page session. */
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!adminKeyInput.value) return;
  adminKey = adminKeyInput.value;
  adminKeyInput.value = "";
  await loadQueues();
});
document.querySelector("#refresh-queue").addEventListener("click", () => void loadQueues());

/** Update the shared copyright year. */
document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
