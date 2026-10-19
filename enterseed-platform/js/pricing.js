/** Pricing-page billing toggle and shipping estimate calculator. */
const billingToggle = document.querySelector("#billing-toggle");
const monthlyLabels = document.querySelectorAll('[data-billing-label="monthly"]');
const yearlyLabels = document.querySelectorAll('[data-billing-label="yearly"]');

/** Switch displayed subscription prices and the selected billing cadence. */
function setBilling(yearly) {
  billingToggle.setAttribute("aria-checked", String(yearly));
  billingToggle.setAttribute("aria-label", yearly ? "Switch to monthly billing" : "Switch to yearly billing");
  monthlyLabels.forEach((label) => label.classList.toggle("is-selected", !yearly));
  yearlyLabels.forEach((label) => label.classList.toggle("is-selected", yearly));
  document.querySelectorAll("[data-monthly][data-yearly]").forEach((price) => {
    price.textContent = yearly ? price.dataset.yearly : price.dataset.monthly;
  });
  document.querySelectorAll("[data-period-monthly]").forEach((period) => {
    period.textContent = yearly ? period.dataset.periodYearly : period.dataset.periodMonthly;
  });
  document.querySelectorAll("[data-detail-monthly]").forEach((detail) => {
    detail.textContent = yearly ? detail.dataset.detailYearly : detail.dataset.detailMonthly;
  });
}

/** Toggle the billing state and refresh monthly/yearly labels. */
billingToggle?.addEventListener("click", () => {
  setBilling(billingToggle.getAttribute("aria-checked") !== "true");
});

const shippingToggle = document.querySelector("#shipping-toggle");
const shippingSpend = document.querySelector("#shipping-spend");
const shippingSpendLabel = document.querySelector("#shipping-spend-label");
const shippingCoverage = document.querySelector("#shipping-coverage");
const shippingNet = document.querySelector("#shipping-net");
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** Calculate 25% of shipping spend, capped at the monthly coverage limit. */
function updateShippingEstimate() {
  if (!shippingToggle || !shippingSpend || !shippingSpendLabel || !shippingCoverage || !shippingNet) return;
  const spend = Number(shippingSpend.value);
  const covered = shippingToggle.checked ? Math.min(spend * 0.25, 350) : 0;
  shippingSpendLabel.textContent = peso.format(spend);
  shippingCoverage.textContent = peso.format(covered);
  shippingNet.textContent = peso.format(spend - covered);
}

/** Recalculate when the add-on is toggled or the monthly spend slider changes. */
shippingToggle?.addEventListener("change", updateShippingEstimate);
shippingSpend?.addEventListener("input", updateShippingEstimate);
if (shippingToggle && shippingSpend) updateShippingEstimate();