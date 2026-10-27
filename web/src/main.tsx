import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
// Variable shriftlar: har bir og'irlik uchun alohida fayl o'rniga bittadan (latin + latin-ext)
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App";
// Dashboard va Foydalanuvchilar alohida bo'lakda — operator kanbanni ochganda ularning kodi yuklanmaydi
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const UsersPage = lazy(() => import("./pages/Users").then((m) => ({ default: m.UsersPage })));
import { Shell } from "./components/Shell";
import { usePath } from "./lib/router";

// Ichki marshrutlash (sahifa qayta yuklanmaydi): /dashboard — boshliqlar, /users — foydalanuvchilar (dasturchi), qolgani — doska
function Root() {
  const path = usePath();
  const page = path === "/dashboard" ? <Dashboard key="dashboard" /> : path === "/users" ? <UsersPage key="users" /> : <App key="kanban" />;
  return (
    <Shell>
      <Suspense fallback={<div className="page-loading">Yuklanmoqda…</div>}>{page}</Suspense>
    </Shell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
