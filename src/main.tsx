import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import BotApp from "./BotApp.tsx";

const isBotRoute = window.location.pathname.startsWith("/bot");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isBotRoute ? <BotApp /> : <App />}</StrictMode>,
);
