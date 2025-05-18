import React, {useEffect, useRef, useState, useMemo} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./Menu.scss";
import scenarios from "../../Data/Scenario";
import {sendGameSetup} from "./MenuAPI";

const disasterColors = {
    "Avalanche": '#ffecec',
    "River Flood": '#e7eaff',
    "Heatwave": '#fae8cc',
    "Severe Storm": '#e5e5e5',
    "Volcanic Eruption": '#ffe2e2',
    "Wildfire": '#f1ffdf'
};

const ROLE_OPTIONS = [
    { value: 'Medical Director', label: 'Medical Director', desc: 'Oversee medical operations and make critical care decisions' },
    { value: 'Logistics Coordinator', label: 'Logistics Coordinator', desc: 'Manage resource distribution and transportation' },
    { value: 'Resource Manager', label: 'Resource Manager', desc: 'Track and allocate available resources' }
];

export default function Menu({ onResources }) {
    const mapContainerRef = useRef(null);
    const [map, setMap] = useState(null);
    const markersRef = useRef([]);

    const [formData, setFormData] = useState({
        userName: "",
        userRole: "",
        disasterType: "",
        country: "",
        region: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0]
    });
    const [file, setFile] = useState(null);

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

    useEffect(() => {
        if (map || !mapContainerRef.current) return;
        const instance = new maplibregl.Map({
            container: mapContainerRef.current,
            style:
                'https://api.maptiler.com/maps/topo-v2/style.json?key=leLKcJqFrGkjyFiGlG7L',
            center: [5.4, 52.1],
            zoom: 6,
            maxBounds: [[-25.0, 30.0], [45.0, 72.0]]
        });
        instance.dragRotate.disable();
        instance.touchZoomRotate.disableRotation();
        setMap(instance);

    }, [map]);

    useEffect(() => {
        if (!map) return;
        if (formData.region) {
            const scenario = filteredScenarios.find(
                s => s.country === formData.country && s.region === formData.region
            );
            if (scenario) map.flyTo({center: scenario.coords, zoom: 10, speed: 1.2});
        } else if (formData.country) {
            const countryScenarios = filteredScenarios.filter(s => s.country === formData.country);
            if (countryScenarios.length) {
                const [lng, lat] = countryScenarios[0].coords;
                map.flyTo({center: [lng, lat], zoom: 6.5, speed: 1.2});
            }
        }
    }, [map, formData.country, formData.region, filteredScenarios]);

    useEffect(() => {
        if (!map) return;
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = filteredScenarios.map(scenario => {
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.style.width = '60px';
            el.style.height = '60px';
            el.style.backgroundImage = `url(${scenario.icon || '../../../icons/default.png'})`;
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundPosition = 'center';
            el.style.borderRadius = '50%';
            el.style.boxShadow = '0px 4px 16px 0px rgba(0,0,0,0.5)';
            el.style.cursor = 'pointer';

            return new maplibregl.Marker({element: el, offset: [0, 50]})
                .setLngLat(scenario.coords)
                .setPopup(new maplibregl.Popup().setHTML(
                    `<strong>${scenario.city}</strong><br/>${scenario.description}`
                ))
                .addTo(map);
        });
    }, [map, filteredScenarios]);

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

    const duration = Math.max(
        0,
        (new Date(formData.endDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24)
    );

    const isFormComplete = formData.userName && formData.userRole && formData.disasterType && formData.country && formData.region && file;

    const handleStartSimulation = async () => {
        if (!isFormComplete) return;
        const scenario = scenarios.find(
            s => s.disasterType === formData.disasterType &&
                s.country === formData.country &&
                s.region === formData.region
        );
        if (!scenario) return;

        const gameData = {
            userName: formData.userName,
            userRole: formData.userRole,
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
    const resources = await sendGameSetup(gameData, file);
    // resources is now the array itself
    onResources && onResources(resources);
    localStorage.setItem("resources", JSON.stringify(resources));
    localStorage.setItem("location", formData.country + ", " + formData.region);
    localStorage.setItem('disaster_game_setup', JSON.stringify(gameData));

      window.location.href = "/game";
    } catch (err) {
      alert(err.message);
        }
    };

    return (
        <div className="menu-layout">
            <div className="form-panel"
                 style={{background: disasterColors[formData.disasterType] || '#fff', transition: 'background 0.4s'}}>
                <h2>Disaster Inc.:<br/>Medical Crisis Underwater</h2>
                <p>Configure a disaster scenario in Europe to test your medical logistics and crisis management skills.</p>

                <input type="text" name="userName" placeholder="Enter your name"
                       value={formData.userName} onChange={handleChange}/>

                <label>Select Your Role</label>
                <div className="role-options">
                    {ROLE_OPTIONS.map(opt => (
                        <label key={opt.value} className={formData.userRole === opt.value ? 'selected' : ''}>
                            <input type="radio" name="userRole" value={opt.value}
                                   checked={formData.userRole === opt.value} onChange={handleChange}/>
                            <div className="role-card">
                                <div className="role-label">{opt.label}</div>
                                <div className="role-desc">{opt.desc}</div>
                            </div>
                        </label>
                    ))}
                </div>

                <label>Disaster Type</label>
                <select name="disasterType" value={formData.disasterType} onChange={handleChange}>
                    <option value="">-- Select Disaster Type --</option>
                    {allDisasters.map(type => (
                        <option key={type} value={type}
                                disabled={!scenarios.some(s => s.disasterType === type && s.available)}>
                            {type}
                        </option>
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
                <input type="file" onChange={handleFileChange}/>

                <label>Start Date</label>
                <input type="date" name="startDate" value={formData.startDate}
                       onChange={handleChange}/>
                <label>End Date</label>
                <input type="date" name="endDate" value={formData.endDate}
                       onChange={handleChange}/>
                <p className="duration">Duration: {duration} days</p>

                <button onClick={handleStartSimulation} className="start-button"
                        disabled={!isFormComplete}>
                    Start Simulation
                </button>
            </div>
            <div ref={mapContainerRef} className="map-container" />
        </div>
    );
}
