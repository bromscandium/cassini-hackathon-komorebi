import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Game.scss';
import { submitGameAction } from './GameAPI';

export default function Game() {
    const mapContainerRef = useRef(null);
    const [map, setMap] = useState(null);
    const [setup, setSetup] = useState(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const [currentTime, setCurrentTime] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');

    // side panels visibility
    const [showChat, setShowChat] = useState(true);
    const [showDashboard, setShowDashboard] = useState(true);

    const resources = [
        { type: 'header', label: '🏥 Medical Resources' },
        { name: 'Ambulances', available: 5, icon: '🚑' },
        { name: 'Doctors', available: 10, icon: '👨‍⚕️' },
        { name: 'Nurses', available: 20, icon: '👩‍⚕️' },
        { name: 'Medical Kits', available: 30, icon: '🧰' },
        { name: 'Generators', available: 8, icon: '⚡' },
        { type: 'header', label: '🚚 Logistics & Support' },
        { name: 'Rescue Boats', available: 6, icon: '🚤' },
        { name: 'Fuel Reserves', available: 50, icon: '⛽' },
        { name: 'Comm Radios', available: 15, icon: '📻' },
        { name: 'Water Units', available: 10, icon: '💧' },
        { name: 'Shelter Tents', available: 12, icon: '⛺' }
    ];

    // load game setup from localStorage
    useEffect(() => {
        const data = localStorage.getItem('disaster_game_setup');
        if (data) {
            const parsed = JSON.parse(data);
            setSetup(parsed);
            setCurrentTime(new Date(parsed.startDate));
        }
    }, []);

    // init map
    useEffect(() => {
        if (map || !setup) return;
        const instance = new maplibregl.Map({
            container: mapContainerRef.current,
            style:
                'https://api.maptiler.com/maps/topo-v2/style.json?key=leLKcJqFrGkjyFiGlG7L',
            center: setup.coords,
            zoom: 10
        });
        instance.dragRotate.disable();
        instance.touchZoomRotate.disableRotation();
        setMap(instance);
    }, [map, setup]);

    // advance time every 5s
    useEffect(() => {
        if (!currentTime) return;
        const iv = setInterval(() => {
            if (isPlaying && !isTyping) {
                setCurrentTime((t) => new Date(t.getTime() + 3600 * 1000));
            }
        }, 5000);
        return () => clearInterval(iv);
    }, [currentTime, isPlaying, isTyping]);

    const togglePlay = () => setIsPlaying((p) => !p);

    // send action + receive result
    const handleSend = async () => {
        if (!inputValue.trim()) return;
        const payload = {
            text: inputValue,
            timestamp: currentTime.toISOString()
        };
        setInputValue('');
        setIsTyping(false);

        try {
            const { action, result } = await submitGameAction(payload);
            setMessages((msgs) => [
                ...msgs,
                { sender: 'You', text: action, time: new Date() },
                { sender: 'System', text: `Result: ${result}`, time: new Date() }
            ]);
        } catch (err) {
            console.error(err);
            alert('Failed to send action');
        }
    };

    return (
        <div className="game-layout">
            {/* left chat panel */}
            {showChat && (
                <div className="chat-panel" style={{ width: '15%' }}>
                    <div className="status-bar">
                        <div className="stability-bar">
                            <div className="bar-fill" style={{ width: '80%' }} />
                        </div>
                    </div>
                    <div className="chat-history">
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`message ${m.sender === 'You' ? 'user' : 'system'}`}
                            >
                                <strong>{m.sender}:</strong> {m.text}
                                <span className="time">
                  {m.time.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                  })}
                </span>
                            </div>
                        ))}
                    </div>
                    <div className="chat-input-area">
            <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                placeholder="Describe your action..."
            />
                        <button onClick={handleSend}>Submit Response</button>
                        <div className="guideline">
                            Enter a clear, concise action plan for the scenario.
                        </div>
                    </div>
                </div>
            )}

            {/* center map */}
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
                    <button onClick={togglePlay}>
                        {isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={() => setShowChat((v) => !v)}>
                        {showChat ? 'Hide Chat' : 'Show Chat'}
                    </button>
                    <button onClick={() => setShowDashboard((v) => !v)}>
                        {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
                    </button>
                </div>
                <div ref={mapContainerRef} className="map-container" />
            </div>

            {/* right dashboard panel */}
            {showDashboard && (
                <div className="dashboard-panel" style={{ width: '10%' }}>
                    <h3>Resource Panel</h3>
                    <ul className="resources-list">
                        {resources.map((r, idx) =>
                                r.type === 'header' ? (
                                    <li key={idx} className="resource-header">
                                        {r.icon} {r.label}
                                    </li>
                                ) : (
                                    <li key={idx} className="resource-item">
                                        <span className="icon">{r.icon}</span>
                                        <span className="name">{r.name}</span>
                                        <span className="count">
                    {r.available} / {r.available} available
                  </span>
                                    </li>
                                )
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
