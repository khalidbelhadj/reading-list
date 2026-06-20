import { getSettings, setSettings } from "./api.js";

const toggle = document.getElementById("dev-toggle");
const openInAppToggle = document.getElementById("open-in-app-toggle");
const urlField = document.getElementById("url-field");
const input = document.getElementById("app-url");
const saveBtn = document.getElementById("save");
const savedMsg = document.getElementById("saved-msg");

const isOn = (el) => el.getAttribute("aria-checked") === "true";

// the last-saved settings, used to detect unsaved changes
let saved = { devMode: false, appUrl: "", openIn: "web" };

const current = () => ({
  devMode: isOn(toggle),
  appUrl: input.value.trim(),
  openIn: isOn(openInAppToggle) ? "app" : "web",
});

const isDirty = () => {
  const now = current();
  return (
    now.devMode !== saved.devMode ||
    now.appUrl !== saved.appUrl ||
    now.openIn !== saved.openIn
  );
};

const refresh = () => {
  urlField.hidden = !isOn(toggle);
  saveBtn.disabled = !isDirty();
};

const init = async () => {
  const { devMode, appUrl, openIn } = await getSettings();
  input.value = appUrl;
  toggle.setAttribute("aria-checked", devMode ? "true" : "false");
  openInAppToggle.setAttribute(
    "aria-checked",
    openIn === "app" ? "true" : "false",
  );
  saved = current();
  refresh();
};

const bindToggle = (el) => {
  el.addEventListener("click", () => {
    el.setAttribute("aria-checked", isOn(el) ? "false" : "true");
    savedMsg.hidden = true;
    refresh();
  });
};

bindToggle(toggle);
bindToggle(openInAppToggle);

input.addEventListener("input", () => {
  savedMsg.hidden = true;
  refresh();
});

saveBtn.addEventListener("click", async () => {
  saved = current();
  await setSettings(saved);
  savedMsg.hidden = false;
  refresh();
});

init();
