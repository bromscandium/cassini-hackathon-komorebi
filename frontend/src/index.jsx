import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.scss"
import {DisasterProvider} from "./Functions/DisasterContext";

ReactDOM.createRoot(document.getElementById("root")).render(
    <DisasterProvider>
        <App/>
    </DisasterProvider>
);
