import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles/index.css";
import App from "./App";
import { SafarProvider } from "./state/SafarStateContext";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("SAFAR root element was not found in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <SafarProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SafarProvider>
  </React.StrictMode>,
);
