import React, {useEffect, useRef, useState, useMemo} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./Menu.scss";
import scenarios from "../../Data/Scenario";
import {sendGameSetup} from "./MenuAPI";

// Static map of disaster colors, moved outside component to ensure stable reference
const disasterColors = {
    "Avalanche": '#9bd2f9',
    "River Flood": '#8fe6c1',
    "Heatwave": '#ffd06b',
    "Severe Storm": '#b9c5f9',
    "Volcanic Eruption": '#f97b7b',
    "Wildfire": '#e48d2a'
};

export default function Menu() {
    const mapContainerRef = useRef(null);
    const [map, setMap] = useState(null);
    const markersRef = useRef([]);

    const [formData, setFormData] = useState({
        disasterType: "",
        country: "",
        region: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0]
    });
    const [file, setFile] = useState(null);

    // Memoized filtered data
    const filteredScenarios = useMemo(
        () => scenarios.filter(s => !formData.disasterType || s.disasterType === formData.disasterType),
        [formData.disasterType]
    );
    const filteredCountries = useMemo(
        () => [...new Set(filteredScenarios.filter(s => s.available).map(s => s.country))],
        [filteredScenarios]
    );
    const filteredRegions = useMemo(
        () => [...new Set(filteredScenarios.filter(s => s.country === formData.country && s.available).map(s => s.region))],
        [filteredScenarios, formData.country]
    );
    const allDisasters = useMemo(
        () => [...new Set(scenarios.map(s => s.disasterType))],
        []
    );

    // Initialize map
    useEffect(() => {
        if (map || !mapContainerRef.current) return;
        const instance = new maplibregl.Map({
            container: mapContainerRef.current,
            style: "https://api.maptiler.com/maps/topo-v2/style.json?key=leLKcJqFrGkjyFiGlG7L",
            center: [5.4, 52.1],
            zoom: 6,
            maxBounds: [[-25.0, 30.0], [45.0, 72.0]]
        });
        instance.dragRotate.disable();
        instance.touchZoomRotate.disableRotation();
        setMap(instance);
    }, [map]);

    // Fly to country or region
    useEffect(() => {
        if (!map) return;
        if (formData.region) {
            const scenario = filteredScenarios.find(s => s.country === formData.country && s.region === formData.region);
            if (scenario) map.flyTo({center: scenario.coords, zoom: 10, speed: 1.2});
        } else if (formData.country) {
            const countryScenarios = filteredScenarios.filter(s => s.country === formData.country);
            if (countryScenarios.length) {
                const [lng, lat] = countryScenarios[0].coords;
                map.flyTo({center: [lng, lat], zoom: 6.5, speed: 1.2});
            }
        }
    }, [map, formData.country, formData.region, filteredScenarios]);

    // Utility: hex to rgba conversion
    function hexToRgba(hex, alpha = 0.4) {
        let c = hex.substring(1).split('');
        if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        const [r, g, b] = [
            parseInt(c[0] + c[1], 16),
            parseInt(c[2] + c[3], 16),
            parseInt(c[4] + c[5], 16)
        ];
        return `rgba(${r},${g},${b},${alpha})`;
    }

    // Render markers when filteredScenarios change
    useEffect(() => {
        if (!map) return;
        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = filteredScenarios.map(scenario => {
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.style.width = '44px';
            el.style.height = '44px';
            el.style.backgroundImage = `url(${scenario.icon || '../../../icons/default.png'})`;
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundPosition = 'center';
            el.style.borderRadius = '50%';
            const color = disasterColors[scenario.disasterType] || '#000';
            el.style.boxShadow = `0 2px 12px 0 ${hexToRgba(color)}`;
            el.style.cursor = 'pointer';

            return new maplibregl.Marker({element: el})
                .setLngLat(scenario.coords)
                .setPopup(new maplibregl.Popup().setHTML(
                    `<strong>${scenario.city}</strong><br/>${scenario.description}`
                ))
                .addTo(map);
        });
    }, [map, filteredScenarios]);

    // Form handlers
    const handleChange = e => {
        const {name, value} = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'disasterType' ? {country: '', region: ''} : {}),
            ...(name === 'country' ? {region: ''} : {})
        }));
    };

    const handleFileChange = e => {
        setFile(e.target.files[0] || null);
    };

    // Compute duration
    const duration = Math.max(
        0,
        (new Date(formData.endDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24)
    );

    // Start simulation: send data to backend

    const handleStartSimulation = async () => {
        const scenario = scenarios.find(
            s => s.disasterType === formData.disasterType &&
                s.country === formData.country &&
                s.region === formData.region
        );
        if (!scenario) return;

        const gameData = {
            disasterType: formData.disasterType,
            country: formData.country,
            region: formData.region,
            startDate: formData.startDate,
            endDate: formData.endDate,
            duration,
            coords: scenario.coords,
            scenarioId: scenario.id,
            description: scenario.description
        };

        try {
            const response = await sendGameSetup(gameData, file);
            console.log('Backend response:', response);
            localStorage.setItem('disaster_game_setup', JSON.stringify(gameData));
            window.location.href = '/game';
        } catch (err) {
            alert(`Failed to start simulation: ${err.message}`);
        }
    };

    return (
        <div className="menu-layout">
            <div className="form-panel"
                 style={{background: disasterColors[formData.disasterType] || '#fff', transition: 'background 0.4s'}}>
                <h2>Disaster Inc.:<br/>Medical Crisis Underwater</h2>
                <p>Configure a disaster scenario in Europe to test your medical logistics and crisis management
                    skills.</p>

                <label>Disaster Type</label>
                <select name="disasterType" value={formData.disasterType} onChange={handleChange}>
                    <option value="">-- Select Disaster Type --</option>
                    {allDisasters.map(type => (
                        <option key={type} value={type}
                                disabled={!scenarios.some(s => s.disasterType === type && s.available)}>{type}</option>
                    ))}
                </select>

                <label>Country</label>
                <select name="country" value={formData.country} onChange={handleChange}
                        disabled={!formData.disasterType}>
                    <option value="">-- Select Country --</option>
                    {filteredCountries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <label>Specific Region</label>
                <select name="region" value={formData.region} onChange={handleChange} disabled={!formData.country}>
                    <option value="">-- Select Region --</option>
                    {filteredRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                <label>Attach File</label>
                <input type="file" onChange={handleFileChange} />

                <label>Start Date</label><input type="date" name="startDate" value={formData.startDate}
                                                onChange={handleChange}/>
                <label>End Date</label><input type="date" name="endDate" value={formData.endDate}
                                              onChange={handleChange}/>
                <p className="duration">Duration: {duration} days</p>


                <button onClick={handleStartSimulation}
                        disabled={!(formData.disasterType && formData.country && formData.region)}
                        className="start-button">
                    Start Simulation
                </button>
            </div>
            <div ref={mapContainerRef} className="map-container active"/>
        </div>
    );
}
