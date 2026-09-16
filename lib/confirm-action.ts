type Confirmation = { title: string; message: string; confirmLabel: string; cancelLabel?: string; danger?: boolean };
let pending: Promise<boolean> | null = null;

/** A native top-layer dialog keeps confirmations above other app modals. */
export function confirmAction(options: Confirmation): Promise<boolean> {
  if (pending) return Promise.resolve(false);
  const result = new Promise<boolean>((resolve) => {
    const previous = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "app-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "app-confirm-title");
    dialog.setAttribute("aria-describedby", "app-confirm-description");
    const icon = document.createElement("span");
    icon.className = "app-confirm-icon";
    icon.textContent = options.danger ? "!" : "?";
    icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("h2");
    title.id = "app-confirm-title"; title.textContent = options.title;
    const description = document.createElement("p");
    description.id = "app-confirm-description"; description.textContent = options.message;
    const actions = document.createElement("div"); actions.className = "app-confirm-actions";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = options.cancelLabel ?? "先不要"; cancel.autofocus = true;
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.textContent = options.confirmLabel; confirm.className = options.danger ? "confirm-danger" : "confirm-primary";
    cancel.addEventListener("click", () => dialog.close("cancel"));
    confirm.addEventListener("click", () => dialog.close("confirm"));
    dialog.addEventListener("close", () => { const accepted = dialog.returnValue === "confirm"; dialog.remove(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); resolve(accepted); }, { once: true });
    actions.append(cancel, confirm); dialog.append(icon, title, description, actions); document.body.append(dialog);
    dialog.showModal();
  });
  pending = result;
  void result.finally(() => { pending = null; });
  return result;
}
