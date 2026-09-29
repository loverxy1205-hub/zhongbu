import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./Zhongbu.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // Current-session calculation needs no worker. The UI is still usable.
      });
  });
}
