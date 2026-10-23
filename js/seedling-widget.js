(function seedlingWidget() {
const widgetCopy = {
  en: {
    open: "Chat with Seedling",
    close: "Close chat",
    title: "Seedling",
    subtitle: "Your business growth companion",
    greeting: "Hi! I’m Seedling. What can I help you with today?",
    disclaimer: "AI can make mistakes. Confirm important details with official sources.",
    placeholder: "Ask a business question…",
    send: "Send message",
    waiting: "Seedling is thinking…",
    error: "I couldn’t reach the assistant. Please try again in a moment.",
  },
  fil: {
    open: "Makipag-chat kay Seedling",
    close: "Isara ang chat",
    title: "Seedling",
    subtitle: "Kasama mo sa pagpapalago ng negosyo",
    greeting: "Kumusta! Ako si Seedling. Paano kita matutulungan ngayon?",
    disclaimer: "Maaaring magkamali ang AI. Tiyakin ang mahahalagang detalye sa mga opisyal na sanggunian.",
    placeholder: "Magtanong tungkol sa negosyo…",
    send: "Ipadala ang mensahe",
    waiting: "Nag-iisip si Seedling…",
    error: "Hindi ko maabot ang assistant. Pakisubukang muli maya-maya.",
  }
};

const conversation = [];
const widget = document.createElement("section");
widget.className = "seedling-widget";
widget.setAttribute("aria-label", "Seedling AI assistant");

const launcher = document.createElement("button");
launcher.className = "seedling-launcher";
launcher.type = "button";
launcher.setAttribute("aria-expanded", "false");
launcher.setAttribute("aria-controls", "seedling-panel");
launcher.setAttribute("aria-label", widgetCopy.en.open);
const launcherAvatar = document.createElement("img");
launcherAvatar.src = "logos/Icon.png";
launcherAvatar.alt = "";
launcherAvatar.setAttribute("aria-hidden", "true");
launcher.append(launcherAvatar);

const panel = document.createElement("div");
panel.className = "seedling-panel";
panel.id = "seedling-panel";
panel.hidden = true;
panel.setAttribute("role", "dialog");
panel.setAttribute("aria-labelledby", "seedling-title");

const header = document.createElement("header");
header.className = "seedling-header";
const identity = document.createElement("div");
identity.className = "seedling-identity";
const headerAvatar = document.createElement("img");
headerAvatar.className = "seedling-avatar";
headerAvatar.src = "logos/Icon.png";
headerAvatar.alt = "";
headerAvatar.setAttribute("aria-hidden", "true");
const identityText = document.createElement("div");
const title = document.createElement("strong");
title.id = "seedling-title";
title.textContent = widgetCopy.en.title;
const subtitle = document.createElement("span");
subtitle.textContent = widgetCopy.en.subtitle;
identityText.append(title, subtitle);
identity.append(headerAvatar, identityText);

const closeButton = document.createElement("button");
closeButton.className = "seedling-close";
closeButton.type = "button";
closeButton.setAttribute("aria-label", widgetCopy.en.close);
closeButton.textContent = "×";
header.append(identity, closeButton);

const messages = document.createElement("div");
messages.className = "seedling-messages";
messages.setAttribute("aria-live", "polite");
messages.setAttribute("aria-relevant", "additions text");

const disclaimer = document.createElement("p");
disclaimer.className = "seedling-disclaimer";
disclaimer.textContent = widgetCopy.en.disclaimer;

const form = document.createElement("form");
form.className = "seedling-form";
const input = document.createElement("input");
input.type = "text";
input.name = "question";
input.maxLength = 1200;
input.autocomplete = "off";
input.required = true;
input.setAttribute("aria-label", widgetCopy.en.placeholder);
input.placeholder = widgetCopy.en.placeholder;
const sendButton = document.createElement("button");
sendButton.type = "submit";
sendButton.className = "seedling-send";
sendButton.setAttribute("aria-label", widgetCopy.en.send);
sendButton.textContent = "↑";
form.append(input, sendButton);

panel.append(header, messages, disclaimer, form);
widget.append(launcher, panel);
document.body.append(widget);

function currentCopy() {
  return widgetCopy[window.EnterseedLanguage?.current === "fil" ? "fil" : "en"];
}

function appendMessage(text, sender) {
  const message = document.createElement("div");
  message.className = `seedling-message ${sender === "user" ? "seedling-user" : "seedling-assistant"}`;
  if (sender === "assistant") {
    const avatar = document.createElement("img");
    avatar.src = "logos/Icon.png";
    avatar.alt = "";
    avatar.setAttribute("aria-hidden", "true");
    message.append(avatar);
  }
  const bubble = document.createElement("p");
  bubble.textContent = text;
  message.append(bubble);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

function syncLanguage() {
  const copy = currentCopy();
  launcher.setAttribute("aria-label", launcher.getAttribute("aria-expanded") === "true" ? copy.close : copy.open);
  closeButton.setAttribute("aria-label", copy.close);
  subtitle.textContent = copy.subtitle;
  disclaimer.textContent = copy.disclaimer;
  input.placeholder = copy.placeholder;
  input.setAttribute("aria-label", copy.placeholder);
  sendButton.setAttribute("aria-label", copy.send);
  const greeting = messages.querySelector(".seedling-greeting p");
  if (greeting) {
    greeting.textContent = copy.greeting;
  } else if (messages.childElementCount === 0) {
    const message = appendMessage(copy.greeting, "assistant");
    message.classList.add("seedling-greeting");
  }
}

async function submitQuestion(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || sendButton.disabled) return;
  appendMessage(cleanQuestion, "user");
  input.value = "";
  sendButton.disabled = true;
  const typingMessage = document.createElement("p");
  typingMessage.className = "seedling-typing";
  typingMessage.setAttribute("role", "status");
  typingMessage.textContent = currentCopy().waiting;
  messages.append(typingMessage);
  messages.scrollTop = messages.scrollHeight;

  const language = window.EnterseedLanguage?.current === "fil" ? "fil" : "en";
  const requestQuestion = cleanQuestion;
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        question: requestQuestion,
        history: conversation.slice(-8),
        language
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Assistant request failed with status ${response.status}.`);
    const result = await response.json();
    if (typeof result.answer !== "string" || !result.answer.trim()) {
      throw new Error("Assistant response did not include an answer.");
    }
    typingMessage.remove();
    appendMessage(result.answer, "assistant");
    conversation.push(
      { role: "user", text: requestQuestion },
      { role: "model", text: result.answer }
    );
    if (conversation.length > 8) conversation.splice(0, conversation.length - 8);
  } catch (error) {
    console.error("Seedling assistant request failed.", error);
    typingMessage.remove();
    appendMessage(currentCopy().error, "assistant");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

function setOpen(isOpen) {
  panel.hidden = !isOpen;
  launcher.setAttribute("aria-expanded", String(isOpen));
  launcher.setAttribute("aria-label", isOpen ? currentCopy().close : currentCopy().open);
  if (isOpen) input.focus();
}

launcher.addEventListener("click", () => setOpen(launcher.getAttribute("aria-expanded") !== "true"));
closeButton.addEventListener("click", () => setOpen(false));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitQuestion(input.value);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    setOpen(false);
    launcher.focus();
  }
});
document.addEventListener("enterseed:languagechange", syncLanguage);
syncLanguage();
})();
