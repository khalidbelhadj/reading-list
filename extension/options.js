import { getSettings, setSettings } from "./api.js";

const toggle = document.getElementById("dev-toggle");
const urlField = document.getElementById("url-field");
const input = document.getElementById("app-url");
const saveBtn = document.getElementById("save");
const savedMsg = document.getElementById("saved-msg");

const refresh = () => {
  urlField.hidden = toggle.getAttribute("aria-checked") !== "true";
};

const init = async () => {
  const { devMode, appUrl } = await getSettings();
  input.value = appUrl;
  toggle.setAttribute("aria-checked", devMode ? "true" : "false");
  refresh();
};

toggle.addEventListener("click", () => {
  toggle.setAttribute(
    "aria-checked",
    toggle.getAttribute("aria-checked") === "true" ? "false" : "true",
  );
  savedMsg.hidden = true;
  refresh();
});

input.addEventListener("input", () => {
  savedMsg.hidden = true;
});

saveBtn.addEventListener("click", async () => {
  await setSettings({
    devMode: toggle.getAttribute("aria-checked") === "true",
    appUrl: input.value.trim(),
  });
  savedMsg.hidden = false;
});

init();
