import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";

/**
 * A page that outlives a deployment.
 *
 * The report writers are loaded on demand, by hashed filename. When a new
 * version is published while a tab is open, the tab still asks for the old
 * names, which the host no longer has, and the first download after a
 * deploy failed with "Failed to fetch dynamically imported module". Vite
 * raises this event for exactly that case; the page reloads itself once
 * and comes back current. The flag keeps a genuinely broken chunk from
 * reloading forever.
 */
window.addEventListener("vite:preloadError", (event) => {
  const key = "niriksha.reloadedForChunk";
  try {
    if (sessionStorage.getItem(key) === location.href) return;
    sessionStorage.setItem(key, location.href);
  } catch {
    // Storage unavailable: one reload is still the right response.
  }
  event.preventDefault();
  location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
