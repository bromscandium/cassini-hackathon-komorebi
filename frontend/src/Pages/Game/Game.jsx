import React, {useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Game.scss';
import ResourceData from '../../Data/ResourceData';
import {submitGameAction, runSimulation} from './GameAPI';

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
    const [userName, setUserName] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const hasUserAction = messages.some(m => m.type === 'action');
    const [userLastResult, setUserLastResult] = useState(null);
    const [aiLastResult, setAiLastResult] = useState(null);
    const [prevResources, setPrevResources] = useState(null);

    const suggestionsMap = {
        'Medical Director': [
            'Assess medical needs',
            'Coordinate medical response',
            'Establish treatment protocols'
        ],
        'Logistics Coordinator': [
            'Evaluate transport routes',
            'Manage supply chain',
            'Coordinate with field teams'
        ],
        'Resource Manager': [
            'Track resource usage',
            'Allocate resources efficiently',
            'Monitor inventory levels'
        ]
    };
    const suggestions = suggestionsMap[userRole] || [];

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
                if (parsed.userName || parsed.userRole) {
                    setUserName(parsed.userName || 'Player');
                    setUserRole(parsed.userRole || 'Medical Director');
                }
                setCrisisStability(newSetup.initialStability);
                setCurrentTime(new Date(parsed.startDate));
            } catch (e) {
                console.error('Invalid setup data:', e);
            }
        } else {
            const fallback = {coords: [4.35, 50.85], zoom: 10, initialStability: 60};
            setSetup(fallback);
            setCurrentTime(new Date());
        }
        setResources(ResourceData);
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

    const handleSubmit = async () => {
        if (!inputValue.trim()) return;
        try {
            const result = await submitGameAction({
                location: setup.coords,
                prompt: inputValue,
                initialStability: setup.initialStability,
                resources,
                messages
            });
            setPrevResources(resources);
            setCrisisStability(result.initialStability);
            setResources(result.resources);
            setUserLastResult(result);
            setMessages(prev => [
                ...prev,
                {
                    type: 'action',
                    title: setup.description,
                    action: inputValue,
                    resultText: result.resultText,
                    feedback: result.feedback,
                    effectiveness: result.effectiveness,
                    time: new Date()
                }
            ]);
            setTurnsLeft(prev => Math.max(prev - 1, 0));
        } catch (err) {
            console.error(err);
        }
        setInputValue('');
    };

    const handleRunSimulation = async () => {
        const actionMessages = messages.filter(m => m.type === 'action');
        if (actionMessages.length === 0) return;

        const payloadMessages = messages.slice(0, -1);

        try {
            const result = await runSimulation({
                location: setup.coords,
                initialStability: setup.initialStability,
                prevResources,
                messages: payloadMessages
            });
            setAiLastResult(result);
        } catch (err) {
            console.error(err);
        }
    };

    const togglePlay = () => setIsPlaying(prev => !prev);

    return (
        <div className="game-layout">
            <button className="toggle-left" onClick={() => setShowLeft(prev => !prev)}>&#8592;</button>
            <button className="toggle-right" onClick={() => setShowRight(prev => !prev)}>&#8594;</button>
            {/* Left: Resource Panel with Stability */}
            {showLeft && (
                <div className="dashboard-panel">
                    <div className="user-info">
                        <p className="user-name">{userName}</p>
                        <p className="user-role">{userRole}</p>
                    </div>
                    <div className="stability-wrapper">
                        <h3>Crisis Stability</h3>
                        <div className="stability-labels">
                            <span>Catastrophic</span>
                            <span>Stable</span>
                        </div>
                        <div className="stability-bar">
                            <div className="bar-fill" style={{width: `${crisisStability}%`, background: groupBg}}/>
                        </div>
                    </div>

                    <h3>Resource Panel</h3>
                    <ul className="resources-list">
                        {resources.map((group, gIdx) => (
                            <React.Fragment key={gIdx}>
                                <li className="resource-header"
                                    style={{background: groupBg}}
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
                        style={{background: groupBg}}
                    >
                        {isPlaying ? 'Paused' : 'Playing'}
                    </button>

                    <span className="sep">|</span>

                    <div className="turns-left">
                        {turnsLeft} turns left
                    </div>
                </div>
                <div ref={mapContainerRef} className="map-container"/>
            </div>

            {/* Right: Action Center */}
            {showRight && (
                <div className="chat-panel">
                    <div className="panel-header">Action Panel</div>
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
                        <div className="action-history">
                            {messages
                                .filter(m => m.type === 'action')
                                .map((m, i) => (
                                    <div key={i} className="action-entry">
                                        <h4>{m.title}</h4>
                                        <p className="user-action">
                                            Your action: &nbsp;{m.action}
                                        </p>
                                        <p className="result">
                                            Result: {m.resultText}
                                        </p>
                                        <div className="feedback">Feedback: {m.feedback}</div>
                                        <div className="effectiveness-container">
                                            <span className="label">Effectiveness:</span>
                                            <div className="effectiveness-bar">
                                                <div
                                                    className="bar-fill"
                                                    style={{width: `${m.effectiveness}%`, background: groupBg}}
                                                />
                                            </div>
                                        </div>
                                        <span className="time">{m.time.toLocaleTimeString()}</span>
                                    </div>
                                ))}
                        </div>
                    </div>

                    <div className="chat-input-area">
                    <textarea
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        placeholder="Describe your action..."
                    />
                        <button
                            onClick={handleSubmit}
                            style={{background: groupBg}}
                            disabled={!inputValue.trim()}
                        >
                            Submit Response
                        </button>
                    </div>

                    <div className="suggestions">
                        <h5>Role-Specific Suggestions:</h5>
                        <ul>
                            {suggestions.map((text, i) => (
                                <li
                                    key={i}
                                    onClick={() => {
                                        setInputValue(prev => (prev.trim() ? prev + ' ' : '') + text);
                                    }}
                                >
                                    {text}
                                </li>
                            ))}
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
                    <button
                        onClick={handleRunSimulation}
                        className="ai-simulation-btn"
                        style={{background: groupBg}}
                        disabled={!hasUserAction}
                    >
                        Run AI Simulation
                    </button>
                </div>
            )}
        </div>
    );
}
