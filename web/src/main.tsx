import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "./index.css";
import App from "./App";
import { Dashboard } from "./pages/Dashboard";
import { UsersPage } from "./pages/Users";
import { Shell } from "./components/Shell";
import { usePath } from "./lib/router";

// Ichki marshrutlash (sahifa qayta yuklanmaydi): /dashboard — boshliqlar, /users — foydalanuvchilar (dasturchi), qolgani — doska
function Root() {
  const path = usePath();
  const page = path === "/dashboard" ? <Dashboard key="dashboard" /> : path === "/users" ? <UsersPage key="users" /> : <App key="kanban" />;
  return <Shell>{page}</Shell>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
