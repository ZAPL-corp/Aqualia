document.addEventListener("DOMContentLoaded", async () => {
  const adToggle = document.getElementById("toggle-adblock");
  const statusMessage = document.getElementById("status-message");
  const statusText = document.getElementById("status-text");
  const protectionTitle = document.getElementById("protection-title");
  const protectionSubtitle = document.getElementById("protection-subtitle");
  const statusCard = document.querySelector(".status-card");
  const modal = document.getElementById("confirm-modal");
  const confirmButton = document.getElementById("modal-confirm");
  let statusTimer;

  const stored = await chrome.storage.local.get({ aqualia_ad_blocked: true });
  adToggle.checked = stored.aqualia_ad_blocked;
  await setProtection(adToggle.checked, false);

  adToggle.addEventListener("change", async () => {
    adToggle.disabled = true;
    try {
      await setProtection(adToggle.checked, true);
      await chrome.storage.local.set({ aqualia_ad_blocked: adToggle.checked });
    } catch (error) {
      adToggle.checked = !adToggle.checked;
      showStatus("Не удалось изменить блокировку рекламы", true);
    } finally {
      adToggle.disabled = false;
    }
  });

  document.getElementById("btn-quick-clean").addEventListener("click", async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      await chrome.browsingData.removeHistory({ since: 0 });
      showStatus("История посещений очищена");
    });
  });

  document.getElementById("btn-ram-freeze").addEventListener("click", async (event) => {
    await runButtonAction(event.currentTarget, async () => {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const candidates = tabs.filter(tab =>
        !tab.active && !tab.pinned && !tab.discarded && Number.isInteger(tab.id) &&
        tab.url && !/^(chrome|edge|about|chrome-extension):/i.test(tab.url)
      );
      let count = 0;
      for (const tab of candidates) {
        try {
          const discarded = await chrome.tabs.discard(tab.id);
          if (discarded) count++;
        } catch (_) {}
      }
      showStatus(count
        ? `Выгружено фоновых вкладок: ${count}`
        : "Нет доступных для выгрузки вкладок");
    });
  });

  document.getElementById("btn-danger-zone").addEventListener("click", () => {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    confirmButton.focus();
  });

  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("active")) closeModal();
  });

  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    try {
      await chrome.browsingData.remove({ since: 0 }, {
        history: true,
        cache: true,
        cookies: true,
        formData: true,
        downloads: true,
        localStorage: true,
        serviceWorkers: true,
        indexedDB: true,
        cacheStorage: true,
        webSQL: true
      });
      closeModal();
      showStatus("Данные браузера очищены");
    } catch (_) {
      showStatus("Не удалось полностью очистить данные", true);
    } finally {
      confirmButton.disabled = false;
    }
  });

  document.getElementById("btn-github").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/ZAPL-corp/Aqualia" });
  });

  async function setProtection(enabled, notify) {
    const rules = await chrome.declarativeNetRequest.getEnabledRulesets();
    const hasRuleset = rules.includes("aqualia_ads");
    if (enabled && !hasRuleset) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["aqualia_ads"]
      });
    } else if (!enabled && hasRuleset) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ["aqualia_ads"]
      });
    }

    statusCard.classList.toggle("enabled", enabled);
    protectionTitle.textContent = enabled ? "Защита активна" : "Защита отключена";
    protectionSubtitle.textContent = enabled
      ? "Фильтрация рекламных доменов включена"
      : "Реклама может загружаться";

    if (notify) {
      showStatus(enabled ? "Блокировка рекламы включена" : "Блокировка рекламы отключена");
    }
  }

  async function runButtonAction(button, action) {
    button.disabled = true;
    try {
      await action();
    } catch (_) {
      showStatus("Не удалось выполнить действие", true);
    } finally {
      button.disabled = false;
    }
  }

  function closeModal() {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }

  function showStatus(message, isError = false) {
    clearTimeout(statusTimer);
    statusMessage.classList.toggle("error", isError);
    statusText.textContent = message;
    statusTimer = setTimeout(() => {
      statusMessage.classList.remove("error");
      statusText.textContent = "Aqualia готова к работе";
    }, 3500);
  }
});