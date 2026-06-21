import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The web app remains fully functional if registration is unavailable.
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
