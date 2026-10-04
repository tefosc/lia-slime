import React from "react";
import ReactDOM from "react-dom/client";
import { Isla } from "./Isla";
import "../globo/globo.css";
import "./isla.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Isla />
  </React.StrictMode>,
);
