import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "@/components/Dashboard";
import { QuestList } from "@/components/QuestList";
import "./styles.css";

function App() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (hash === "#/quests") return <QuestList />;
  return <Dashboard />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
