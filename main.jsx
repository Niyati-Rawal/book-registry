import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./registry.css"
import BookRegistry from "./BookRegistry"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BookRegistry />
  </StrictMode>
)