import React from "react";
import { createRoot } from "react-dom/client";
import App from "./arc.app.jsx";   // NOTE: leading ./ and exact casing
createRoot(document.getElementById("root")).render(<App />);

