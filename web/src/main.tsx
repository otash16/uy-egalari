import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "@fontsource/onest/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./index.css";
import App from "./App";
import { Dashboard } from "./pages/Dashboard";

// Oddiy marshrut: /dashboard — boshliqlar sahifasi, qolgani — doska
const page = location.pathname.replace(/\/+$/, "") === "/dashboard" ? <Dashboard /> : <App />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {page}
  </StrictMode>,
);
