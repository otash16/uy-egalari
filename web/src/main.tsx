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
import { UsersPage } from "./pages/Users";
import { Shell } from "./components/Shell";

// Oddiy marshrut: /dashboard — boshliqlar sahifasi, /users — foydalanuvchilar (dasturchi), qolgani — doska
const path = location.pathname.replace(/\/+$/, "");
const page = path === "/dashboard" ? <Dashboard /> : path === "/users" ? <UsersPage /> : <App />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell>{page}</Shell>
  </StrictMode>,
);
