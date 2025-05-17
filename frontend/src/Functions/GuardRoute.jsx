import React from "react";
import {Navigate} from "react-router-dom";
import {useDisaster} from "./DisasterContext";

export default function GuardResultsRoute({children}) {
    const {gameCondition} = useDisaster();

    return gameCondition === "won" || gameCondition === "lost"
        ? children
        : <Navigate to="/" replace />;
}