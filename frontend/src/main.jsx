import React from "react";
import { createRoot } from "react-dom/client";
import App from "./arc.app.jsx";   // NOTE the leading ./ and exact casing

createRoot(document.getElementById("root")).render(<App />);

