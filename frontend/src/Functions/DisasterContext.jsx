import React, {createContext, useContext, useState} from "react";

const DisasterContext = createContext();

export const useDisaster = () => useContext(DisasterContext);

export function DisasterProvider({children}) {
    const [selectedDisaster, setSelectedDisaster] = useState(null);
    const [gameCondition, setGameCondition] = useState(null);

    return (
        <DisasterContext.Provider value={{
            selectedDisaster,
            setSelectedDisaster,
            gameCondition,
            setGameCondition
        }}>
            {children}
        </DisasterContext.Provider>
    );
}
