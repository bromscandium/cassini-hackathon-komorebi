import React from "react";
import {BrowserRouter, Routes, Route} from "react-router-dom";

import Game from "./Pages/Game/Game";
import Results from "./Pages/Results/Results";
import Menu from "./Pages/Menu/Menu";

import GuardResultsRoute from "./Functions/GuardRoute";

export default function App() {
  const [resources, setResources] = React.useState([]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Menu onResources={setResources} />} />
        <Route path="/game" element={<Game resources={resources} />} />
        <Route path="/results" element={<GuardResultsRoute><Results /></GuardResultsRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
