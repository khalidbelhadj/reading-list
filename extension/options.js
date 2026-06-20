import { getSettings, setSettings } from "./api.js";

const toggle = document.getElementById("dev-toggle");
const openInAppToggle = document.getElementById("open-in-app-toggle");
const urlField = document.getElementById("url-field");
const input = document.getElementById("app-url");
const saveBtn = document.getElementById("save");
const savedMsg = document.getElementById("saved-msg");

const isOn = (el) => el.getAttribute("aria-checked") === "true";

const refresh = () => {
  urlField.hidden = !isOn(toggle);
};

const init = async () => {
  const { devMode, appUrl, openIn } = await getSettings();
  input.value = appUrl;
  toggle.setAttribute("aria-checked", devMode ? "true" : "false");
  openInAppToggle.setAttribute(
    "aria-checked",
    openIn === "app" ? "true" : "false",
  );
  refresh();
};

const bindToggle = (el, onToggle) => {
  el.addEventListener("click", () => {
    el.setAttribute("aria-checked", isOn(el) ? "false" : "true");
    savedMsg.hidden = true;
    onToggle?.();
  });
};

bindToggle(toggle, refresh);
bindToggle(openInAppToggle);

input.addEventListener("input", () => {
  savedMsg.hidden = true;
});

saveBtn.addEventListener("click", async () => {
  await setSettings({
    devMode: isOn(toggle),
    appUrl: input.value.trim(),
    openIn: isOn(openInAppToggle) ? "app" : "web",
  });
  savedMsg.hidden = false;
});

init();
