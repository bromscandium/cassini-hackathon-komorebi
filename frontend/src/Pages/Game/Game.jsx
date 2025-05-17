import React, {useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Game.scss';
import MockData from '../../Data/Mockdata';

const MAP_TILE_STYLE = 'https://api.maptiler.com/maps/topo-v2/style.json?key=leLKcJqFrGkjyFiGlG7L';

const disasterColors = {
    "Avalanche": '#ffb7b7',
    "River Flood": '#a4b1ff',
    "Heatwave": '#ffd58e',
    "Severe Storm": '#797979',
    "Volcanic Eruption": '#a25d5d',
    "Wildfire": '#c0ff79'
};

export default function Game() {
    const [showLeft, setShowLeft] = useState(true);
    const [showRight, setShowRight] = useState(true);
    const mapContainerRef = useRef(null);
    const [map, setMap] = useState(null);
    const [setup, setSetup] = useState(null);
    const [resources, setResources] = useState([]);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [crisisStability, setCrisisStability] = useState(60);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [currentTime, setCurrentTime] = useState(null);
    const groupBg = disasterColors[setup?.disasterType] || '#eee';
    const totalTurns = 20;
    const [turnsLeft, setTurnsLeft] = useState(totalTurns);

    useEffect(() => {
        const saved = window.localStorage.getItem('disaster_game_setup');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const newSetup = {
                    coords: parsed.coords || [4.35, 50.85],
                    zoom: 10,
                    initialStability: 60,
                    ...parsed
                };
                setSetup(newSetup);
                setCrisisStability(newSetup.initialStability);
                setCurrentTime(new Date(parsed.startDate));
            } catch (e) {
                console.error('Invalid setup data:', e);
            }
        } else {
            const fallback = { coords: [4.35, 50.85], zoom: 10, initialStability: 60 };
            setSetup(fallback);
            setCurrentTime(new Date());
        }
        setResources(MockData);
    }, []);

    useEffect(() => {
        if (map || !setup || !setup.coords) return;
        const instance = new maplibregl.Map({
            container: mapContainerRef.current,
            style: MAP_TILE_STYLE,
            center: setup.coords,
            zoom: setup.zoom,
        });
        instance.dragRotate.disable();
        instance.touchZoomRotate.disableRotation();
        setMap(instance);
    }, [map, setup]);

    useEffect(() => {
        if (!currentTime) return;
        const interval = setInterval(() => {
            if (isPlaying && !isTyping) {
                setCurrentTime(prev => new Date(prev.getTime() + 3600 * 1000));
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [currentTime, isPlaying, isTyping]);

    const handleSubmit = () => {
        if (!inputValue.trim()) return;
        setMessages(prev => [
            ...prev,
            { sender: 'You', text: inputValue, time: new Date() },
            { sender: 'System', text: `Result: Situation being processed...`, time: new Date() }
        ]);
        setInputValue('');
        setTurnsLeft(prev => Math.max(prev - 1, 0));
    };

    const togglePlay = () => setIsPlaying(prev => !prev);

    return (
        <div className="game-layout">
            <button className="toggle-left" onClick={() => setShowLeft(prev => !prev)}>&#8592;</button>
            <button className="toggle-right" onClick={() => setShowRight(prev => !prev)}>&#8594;</button>
            {/* Left: Resource Panel with Stability */}
            {showLeft && (
                <div className="dashboard-panel">
                    <div className="stability-wrapper">
                        <h3>Crisis Stability</h3>
                        <div className="stability-labels">
                            <span>Catastrophic</span>
                            <span>Stable</span>
                        </div>
                        <div className="stability-bar">
                            <div className="bar-fill" style={{ width: `${crisisStability}%`, background: groupBg }} />
                        </div>
                    </div>

                    <h3>Resource Panel</h3>
                    <ul className="resources-list">
                        {resources.map((group, gIdx) => (
                            <React.Fragment key={gIdx}>
                                <li className="resource-header"
                                    style={{ background: groupBg }}
                                >
                                    <span className="icon">📦</span> {group.category}
                                </li>
                                {group.items.map((item, iIdx) => (
                                    <li key={iIdx} className="resource-item">
                                        <span className="icon">{item.icon}</span>
                                        <span className="name">{item.name}</span>
                                        <span className="count">{item.available} / {item.total} available</span>
                                    </li>
                                ))}
                            </React.Fragment>
                        ))}
                    </ul>
                </div>
            )}

            {/* Center: Map + DateTime */}
            <div className="map-section">
                <div className="map-controls">
                    <div className="current-time">
                        {currentTime
                            ? currentTime.toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                            : 'Loading...'}
                    </div>

                    <span className="sep">|</span>

                    <button
                        onClick={togglePlay}
                        style={{ background: groupBg }}
                    >
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>

                    <span className="sep">|</span>

                    <div className="turns-left">
                        {turnsLeft} turns left
                    </div>
                </div>
                <div ref={mapContainerRef} className="map-container" />
            </div>

            {/* Right: Action Center */}
            {showRight && (
                <div className="chat-panel">
                    <div className="action-card">
                        <h4>🚑 Ambulance Route Blocked</h4>
                        {setup ? (
                            <p>{setup.description || 'No scenario description available.'}</p>
                        ) : (
                            <p>Loading scenario...</p>
                        )}
                        <div className="progress">Progress: 0 / 1</div>
                    </div>

                    <div className="chat-history">
                        {messages.map((m, i) => (
                            <div key={i} className={`message ${m.sender === 'You' ? 'user' : 'system'}`}>
                                <strong>{m.sender}:</strong> {m.text}
                                <span className="time">{m.time.toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>

                    <div className="chat-input-area">
                    <textarea
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        placeholder="Describe your action..."
                    />
                        <button onClick={handleSubmit}>Submit Response</button>
                    </div>

                    <div className="suggestions">
                        <h5>Role-Specific Suggestions:</h5>
                        <ul>
                            <li>Assess medical needs</li>
                            <li>Coordinate medical response</li>
                            <li>Establish treatment protocols</li>
                        </ul>
                    </div>
                    <div className="guidelines">
                        <h5>Response Guidelines:</h5>
                        <ul>
                            <li>Consider medical relevance, logistical feasibility, and ethical implications</li>
                            <li>Be specific about resources, personnel, and methods</li>
                            <li>Complex crises may require multiple successful actions to fully resolve</li>
                            <li>Resources will only be spent when explicitly mentioned in your response</li>
                        </ul>
                    </div>
                    <button className="ai-simulation-btn">Run AI Simulation</button>
                </div>
            )}
        </div>
    );
}
