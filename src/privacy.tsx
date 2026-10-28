import "@fontsource-variable/geist";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivacyPage } from "./features/privacy/privacy-page.tsx";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element to render into");
}

createRoot(container).render(
  <StrictMode>
    <PrivacyPage />
  </StrictMode>
);
