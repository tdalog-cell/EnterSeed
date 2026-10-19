/** Same-origin contact submission and privacy-minimized MSME readiness wizard. */

/** Announce form state without displaying untrusted response markup. */
function setFormStatus(element, message, state) {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
  element.classList.toggle("is-error", state === "error");
  element.classList.toggle("is-success", state === "success");
}

/** Validate a contact request, then submit it to the same-origin server. */
const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector("#contact-status");
const contactTopic = document.querySelector("#contact-topic");
const contactParameters = new URLSearchParams(location.search);
const supplierRequestId = contactParameters.get("supplierId");
if (contactTopic && contactParameters.has("topic")) {
  const topic = contactParameters.get("topic");
  const option = [...contactTopic.options].find((entry) => entry.textContent === topic || entry.value === topic);
  if (option) contactTopic.value = option.value;
  const supplierName = contactParameters.get("supplier");
  const message = document.querySelector("#contact-message");
  if (supplierName && message) message.value = `Please introduce me to ${supplierName}.`;
}
if (supplierRequestId) {
  const consentDescription = document.querySelector("#contact-consent-description");
  if (consentDescription) consentDescription.textContent = "I agree to share my name, email, and message with this reviewed supplier for an introduction. The request is also retained for up to 180 days; contact Enterseed to request earlier deletion.";
}

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const submitButton = contactForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setFormStatus(contactStatus, "Sending your inquiry securely…", "pending");
  const formData = Object.fromEntries(new FormData(contactForm));
  formData.consent = contactForm.elements.consent.checked;
  delete formData.supplierId;
  const endpoint = supplierRequestId && /^\d+$/.test(supplierRequestId) ? `/api/suppliers/${supplierRequestId}/contact` : "/api/inquiries";
  if (supplierRequestId) {
    formData.name = formData.name || "Supplier inquiry";
    delete formData.topic;
    delete formData.companyFax;
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(formData)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The inquiry could not be sent.");
    contactForm.reset();
    const notificationUnavailable = result.notified === false || result.forwarded === false;
    const notice = notificationUnavailable
      ? `Your inquiry was received (reference ${result.reference}), but email notification is not configured. Enterseed support must check the staff inquiry queue.`
      : "Thanks. Your inquiry was received. The Enterseed support team will follow up using the email you provided.";
    setFormStatus(contactStatus, notice, "success");
  } catch (error) {
    setFormStatus(contactStatus, `${error.message} Please try again using the inquiry form.`, "error");
  } finally {
    submitButton.disabled = false;
  }
});

/** Manage step visibility, progress, accessible labels, and heading focus. */
const readinessForm = document.querySelector("#readiness-form");
const wizardSteps = [...document.querySelectorAll("[data-wizard-step]")];
const wizardNext = document.querySelector("#wizard-next");
const wizardBack = document.querySelector("#wizard-back");
const wizardActions = document.querySelector("#wizard-actions");
const wizardSuccess = document.querySelector("#wizard-success");
const assessmentStatus = document.querySelector("#assessment-status");
const deleteAssessmentButton = document.querySelector("#clear-assessment");
const deleteTokenStorageKey = "enterseed.assessment-delete-token";
let wizardStep = 1;

function renderWizardStep() {
  wizardSteps.forEach((step) => {
    const active = Number(step.dataset.wizardStep) === wizardStep;
    step.hidden = !active;
    step.classList.toggle("is-current", active);
  });
  document.querySelector("#wizard-progress").style.width = `${(wizardStep / wizardSteps.length) * 100}%`;
  document.querySelector("#wizard-step-count").textContent = `0${wizardStep}`;
  wizardBack.hidden = wizardStep === 1;
  wizardNext.innerHTML = wizardStep === wizardSteps.length ? "Get my recommendation <span aria-hidden=\"true\">→</span>" : "Continue <span aria-hidden=\"true\">→</span>";
  const current = wizardSteps[wizardStep - 1];
  const heading = current.querySelector("h2");
  document.querySelector(".onboarding-panel").setAttribute("aria-labelledby", heading.id);
  document.querySelector(".onboarding-panel").setAttribute("aria-describedby", current.querySelector(".step-description").id);
  heading.focus({ preventScroll: true });
}

/** Validate only the current step and require explicit consent before server storage. */
function validateWizardStep() {
  if (wizardStep === 1 && !readinessForm.querySelector('input[name="stage"]:checked')) {
    readinessForm.querySelector('input[name="stage"]').reportValidity();
    return false;
  }
  if (wizardStep === 2) {
    const needs = [...readinessForm.querySelectorAll('input[name="needs"]')];
    const firstNeed = needs[0];
    firstNeed.setCustomValidity(needs.some((input) => input.checked) ? "" : "Choose at least one support area.");
    if (!firstNeed.reportValidity()) return false;
  }
  if (wizardStep === 3) {
    if (!readinessForm.elements.location.reportValidity()) return false;
    if (!readinessForm.elements.consent.checked) {
      readinessForm.elements.consent.reportValidity();
      return false;
    }
  }
  return true;
}

/** Save only the non-contact assessment fields and offer a session-scoped deletion token. */
async function finishAssessment() {
  const needs = [...readinessForm.querySelectorAll('input[name="needs"]:checked')].map((input) => input.value);
  const data = { stage: readinessForm.elements.stage.value, needs, location: readinessForm.elements.location.value, consent: true };
  wizardNext.disabled = true;
  setFormStatus(assessmentStatus, "Saving your minimal assessment…", "pending");
  let saveMessage = "Your recommendation is ready. No contact details were collected.";
  try {
    const response = await fetch("/api/readiness", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Assessment storage is unavailable.");
    sessionStorage.setItem(deleteTokenStorageKey, result.deleteToken);
    deleteAssessmentButton.hidden = false;
    saveMessage = `Your answers were saved without contact details and will be deleted automatically after ${result.retentionDays} days. You can also delete them now.`;
    setFormStatus(assessmentStatus, "Assessment stored securely for up to 30 days.", "success");
  } catch (error) {
    saveMessage = `${error.message} Your recommendation still works, but the assessment was not saved.`;
    setFormStatus(assessmentStatus, error.message, "error");
  }
  const target = needs.includes("suppliers") ? "suppliers.html" : "efiling.html";
  const recommendation = needs.includes("suppliers") ? "Supplier Hub" : "E-Filing & AI";
  document.querySelector("#recommendation-copy").textContent = `Based on your answers, start with ${recommendation}. ${saveMessage}`;
  document.querySelector("#recommendation-link").href = `${target}?recommendation=${encodeURIComponent(needs.join(","))}&location=${encodeURIComponent(data.location)}`;
  wizardSteps[wizardStep - 1].hidden = true;
  wizardActions.hidden = true;
  wizardSuccess.hidden = false;
  document.querySelector(".onboarding-panel").setAttribute("aria-labelledby", "wizard-heading-success");
  wizardSuccess.querySelector("h2").focus({ preventScroll: true });
  wizardNext.disabled = false;
}

/** Advance the wizard only after validating and saving its current step. */
wizardNext?.addEventListener("click", async () => {
  if (!validateWizardStep()) return;
  if (wizardStep === wizardSteps.length) {
    await finishAssessment();
    return;
  }
  wizardStep += 1;
  renderWizardStep();
});

/** Return to the previous assessment step without discarding current selections. */
wizardBack?.addEventListener("click", () => {
  if (wizardStep > 1) {
    wizardStep -= 1;
    renderWizardStep();
  }
});

/** Clear the checkbox group's custom validity after a support option is selected. */
readinessForm?.querySelectorAll('input[name="needs"]').forEach((input) => {
  input.addEventListener("change", () => readinessForm.querySelector('input[name="needs"]').setCustomValidity(""));
});

/** Start a new assessment without restoring prior answers from browser storage. */
document.querySelector("#restart-wizard")?.addEventListener("click", () => {
  readinessForm.reset();
  wizardSuccess.hidden = true;
  wizardActions.hidden = false;
  wizardStep = 1;
  renderWizardStep();
});

/** Delete the server-side assessment using its session-scoped capability token. */
deleteAssessmentButton?.addEventListener("click", async () => {
  const token = sessionStorage.getItem(deleteTokenStorageKey);
  if (!token) {
    setFormStatus(assessmentStatus, "No assessment deletion token is available in this browser session.", "error");
    return;
  }
  deleteAssessmentButton.disabled = true;
  try {
    const response = await fetch(`/api/readiness/${encodeURIComponent(token)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error("The assessment could not be deleted. Please retry.");
    sessionStorage.removeItem(deleteTokenStorageKey);
    deleteAssessmentButton.hidden = true;
    setFormStatus(assessmentStatus, "Your saved assessment was deleted from the server.", "success");
    document.querySelector("#recommendation-copy").textContent = "Your saved answers were deleted. You can still open the recommended page; no contact details were collected.";
  } catch (error) {
    setFormStatus(assessmentStatus, error.message, "error");
  } finally {
    deleteAssessmentButton.disabled = false;
  }
});

if (deleteAssessmentButton) deleteAssessmentButton.hidden = !sessionStorage.getItem(deleteTokenStorageKey);
