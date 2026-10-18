import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app.tsx";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element to render into");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
