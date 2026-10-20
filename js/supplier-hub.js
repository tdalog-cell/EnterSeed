/** Render only opted-in, admin-reviewed supplier listings from the same-origin API. */
const supplierGrid = document.querySelector("#supplier-grid");
const supplierSearch = document.querySelector("#supplier-search");
const supplierCount = document.querySelector("#supplier-count");
const mapStatus = document.querySelector("#map-status");
const applicationForm = document.querySelector("#supplier-application-form");
const applicationStatus = document.querySelector("#supplier-application-status");
const categoryButtons = [...document.querySelectorAll("[data-category]")];
let suppliers = [];
let activeCategory = "all";
let supplierMap;
let geocodeInFlight = false;
let lastGeocodeAt = 0;
const markerLayer = new Map();

/** Prevent duplicate concurrent municipality lookups from the same page. */
async function waitForGeocodingSlot() {
  const remaining = Math.max(0, 1000 - (Date.now() - lastGeocodeAt));
  if (remaining) await new Promise((resolve) => window.setTimeout(resolve, remaining));
  lastGeocodeAt = Date.now();
}

/** Create the region-level map without geocoding or exposing applicant addresses. */
function initializeMap() {
  const mapElement = document.querySelector("#supplier-map");
  if (!mapElement) return;
  if (!window.L) {
    mapStatus.textContent = "The map library did not load. The reviewed supplier directory is still available.";
    return;
  }
  supplierMap = L.map(mapElement, { scrollWheelZoom: false }).setView([6.38, 124.98], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
  }).addTo(supplierMap);
}

/** Show verified status only when the server returned an approval timestamp. */
function renderSuppliers() {
  if (!supplierGrid) return;
  const query = supplierSearch.value.trim().toLowerCase();
  const filtered = suppliers.filter((supplier) => {
    const matchesCategory = activeCategory === "all" || supplier.category === activeCategory;
    const searchText = `${supplier.name} ${supplier.location} ${supplier.category} ${supplier.products}`.toLowerCase();
    return matchesCategory && searchText.includes(query);
  });
  supplierCount.textContent = filtered.length;
  supplierGrid.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = suppliers.length
      ? "No reviewed supplier matches those filters. Try another search."
      : "No suppliers are published yet. Listings appear here only after the business opts in and passes Enterseed’s review.";
    supplierGrid.append(empty);
    return;
  }
  filtered.forEach((supplier) => {
    const card = document.createElement("article");
    card.className = "supplier-card";
    const head = document.createElement("div");
    head.className = "supplier-card-head";
    const monogram = document.createElement("span");
    monogram.className = "supplier-monogram";
    monogram.setAttribute("aria-hidden", "true");
    monogram.textContent = supplier.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const badge = document.createElement("span");
    badge.className = "verified-badge";
    badge.textContent = `✓ Reviewed ${new Date(supplier.verifiedAt).toLocaleDateString()}`;
    head.append(monogram, badge);
    const title = document.createElement("h2");
    title.textContent = supplier.name;
    const category = document.createElement("span");
    category.className = "supplier-category";
    category.textContent = supplier.category.replaceAll("-", " ");
    const location = document.createElement("p");
    location.className = "supplier-location";
    location.textContent = `⌖ ${supplier.location}`;
    const products = document.createElement("p");
    products.className = "supplier-product supplier-detail-line";
    products.textContent = supplier.products;
    const foot = document.createElement("div");
    foot.className = "supplier-card-foot";
    const contactActions = document.createElement("div");
    contactActions.className = "supplier-contact-actions";
    if (supplier.publicEmail) {
      const emailLink = document.createElement("a");
      emailLink.className = "contact-link";
      emailLink.href = `mailto:${supplier.publicEmail}`;
      emailLink.textContent = "Email supplier ↗";
      contactActions.append(emailLink);
    }
    if (supplier.publicPhone) {
      const phoneLink = document.createElement("a");
      phoneLink.className = "contact-link";
      phoneLink.href = `tel:${supplier.publicPhone.replace(/[^\d+]/g, "")}`;
      phoneLink.textContent = supplier.publicPhone;
      contactActions.append(phoneLink);
    }
    const introLink = document.createElement("a");
    introLink.className = "contact-link";
    introLink.href = `about.html?topic=${encodeURIComponent("Supplier inquiry")}&supplierId=${encodeURIComponent(supplier.id)}&supplier=${encodeURIComponent(supplier.name)}#contact`;
    introLink.textContent = supplier.publicEmail || supplier.publicPhone ? "Ask Enterseed ↗" : "Request an introduction ↗";
    contactActions.append(introLink);
    const mapButton = document.createElement("button");
    mapButton.className = "contact-link map-focus-button";
    mapButton.type = "button";
    mapButton.textContent = "Show municipality on map ⌖";
    mapButton.addEventListener("click", () => void locateSupplier(supplier));
    foot.append(contactActions, mapButton);
    card.append(head, title, category, location, products, foot);
    supplierGrid.append(card);
  });
}

/** Load the public endpoint; on API failure, state clearly that no stale demo data is shown. */
async function loadSuppliers() {
  if (!supplierGrid) return;
  try {
    const response = await fetch("/api/suppliers", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Supplier directory could not be reached.");
    const payload = await response.json();
    suppliers = Array.isArray(payload.suppliers) ? payload.suppliers.filter((supplier) => supplier.verifiedAt) : [];
    renderSuppliers();
    if (mapStatus && !suppliers.length) mapStatus.textContent = "No reviewed listing pins are available yet. Search the map by municipality.";
  } catch {
    suppliers = [];
    renderSuppliers();
    if (mapStatus) mapStatus.textContent = "The listing service is unavailable. Try again later; no sample suppliers are displayed.";
  }
}

/** Geocode only after a user asks to view a specific approved supplier's municipality. */
async function locateSupplier(supplier) {
  if (!supplierMap || geocodeInFlight) {
    if (mapStatus && geocodeInFlight) mapStatus.textContent = "A place lookup is already running. Please wait before requesting another.";
    return;
  }
  geocodeInFlight = true;
  try {
    await waitForGeocodingSlot();
    const params = new URLSearchParams({ q: supplier.location });
    const response = await fetch(`/api/places/search?${params}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Map lookup failed. The supplier's municipality remains listed on its card.");
    const payload = await response.json();
    const place = payload.place;
    const coordinates = [place.latitude, place.longitude];
    supplierMap.setView(coordinates, 12, { animate: true });
    let marker = markerLayer.get(supplier.id);
    if (!marker) {
      marker = L.marker(coordinates).addTo(supplierMap);
      const popup = document.createElement("span");
      popup.textContent = `${supplier.name} · ${place.label} · municipality-level location`;
      marker.bindPopup(popup);
      markerLayer.set(supplier.id, marker);
    }
    marker.openPopup();
    mapStatus.textContent = `${supplier.name}: municipality-level location near ${supplier.location}; no street address is shown.`;
  } catch (error) {
    mapStatus.textContent = error.message;
  } finally {
    geocodeInFlight = false;
  }
}

/** Filter existing approved records as the visitor searches. */
supplierSearch?.addEventListener("input", renderSuppliers);
/** Keep category selection state accessible and consistent with filtered results. */
categoryButtons.forEach((button) => button.addEventListener("click", () => {
  activeCategory = button.dataset.category;
  categoryButtons.forEach((filter) => {
    const selected = filter === button;
    filter.classList.toggle("is-active", selected);
    filter.setAttribute("aria-pressed", String(selected));
  });
  renderSuppliers();
}));

/** Use a single user-requested Nominatim lookup; never geocode applications in bulk. */
document.querySelector("#map-search-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const place = document.querySelector("#map-search-input").value.trim();
  if (!place || !supplierMap || geocodeInFlight) return;
  geocodeInFlight = true;
  try {
    await waitForGeocodingSlot();
    const params = new URLSearchParams({ q: place });
    const response = await fetch(`/api/places/search?${params}`, { headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "OpenStreetMap place search is unavailable.");
    supplierMap.setView([payload.place.latitude, payload.place.longitude], 12, { animate: true });
    mapStatus.textContent = `Map centered on ${payload.place.label}.`;
  } catch (error) {
    mapStatus.textContent = `${error.message} Try a municipality or city name.`;
  } finally {
    geocodeInFlight = false;
    lastGeocodeAt = Date.now();
  }
});

/** Toggle optional public contact fields without changing private review contact. */
const publishContactToggle = document.querySelector("#publish-contact");
const publicContactFields = document.querySelector("#public-contact-fields");
publishContactToggle?.addEventListener("change", () => {
  publicContactFields.hidden = !publishContactToggle.checked;
});

/** Submit a private listing application with explicit publication consent. */
applicationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (publishContactToggle?.checked) {
    const publicEmail = document.querySelector("#supplier-public-email");
    const publicPhone = document.querySelector("#supplier-public-phone");
    const hasPublicContact = Boolean(publicEmail.value.trim() || publicPhone.value.trim());
    publicEmail.setCustomValidity(hasPublicContact ? "" : "Provide a public email or phone, or turn off public contact display.");
  }
  if (!applicationForm.reportValidity()) return;
  const submitButton = applicationForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  const formData = Object.fromEntries(new FormData(applicationForm));
  formData.publishContact = publishContactToggle.checked;
  formData.consent = applicationForm.elements.consent.checked;
  try {
    const response = await fetch("/api/supplier-applications", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(formData)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Application could not be submitted.");
    applicationForm.reset();
    publicContactFields.hidden = true;
    applicationStatus.textContent = `Application received for private review. It will not appear in search until approval. ${result.notified ? "The review team was notified." : "Email notification is not configured; the application is retained in the review queue."}`;
    applicationStatus.classList.remove("is-error");
    applicationStatus.classList.add("is-success");
  } catch (error) {
    applicationStatus.textContent = `${error.message} Please try again later or contact Enterseed support.`;
    applicationStatus.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
  }
});

initializeMap();
void loadSuppliers();
