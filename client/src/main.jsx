import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./ui.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
if (import.meta.env.DEV && location.pathname === "/__ui") {
  import("./dev/UiPreview.jsx").then(({ default: Preview }) =>
    root.render(<Preview />),
  );
} else root.render(<App />);
import "./game-ui.css";
