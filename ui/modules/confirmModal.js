const hasDom = typeof document !== "undefined";

let elements = {};
let confirmResolver = null;

export function initConfirm(nextElements = {}) {
  elements = nextElements || {};

  if (!hasDom || !elements.confirmModal) return;

  elements.confirmModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.dataset?.close === "true") closeConfirm(false);
  });

  if (elements.confirmCancelBtn) {
    elements.confirmCancelBtn.addEventListener("click", () => closeConfirm(false));
  }
  if (elements.confirmOkBtn) {
    elements.confirmOkBtn.addEventListener("click", () => closeConfirm(true));
  }
}

export function confirm(message, title = "Confirm action") {
  if (
    !elements.confirmModal
    || !elements.confirmMessage
    || !elements.confirmOkBtn
    || !elements.confirmCancelBtn
    || !elements.confirmTitle
  ) {
    return hasDom ? Promise.resolve(window.confirm(message)) : Promise.resolve(true);
  }
  elements.confirmMessage.textContent = message;
  elements.confirmTitle.textContent = title;
  elements.confirmModal.classList.remove("hidden");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

export function closeConfirm(result) {
  if (!elements.confirmModal) return;
  elements.confirmModal.classList.add("hidden");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}
