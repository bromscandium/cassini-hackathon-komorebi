import React, {useEffect, useRef, useState} from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './Game.scss';
import {fetchInitialBubbles, submitGameAction} from './GameAPI';
import alertIcon from '../../ui/alert.png';
import {useNavigate} from "react-router-dom";
import {useDisaster} from "../../Functions/DisasterContext";

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
    const navigate = useNavigate();
    const {setGameCondition} = useDisaster();
    const [showComparison, setShowComparison] = useState(false);
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
    const [bubbles, setBubbles] = useState([]);
    const [selectedBubble, setSelectedBubble] = useState(null);
    const [showResult, setShowResult] = useState(false);

    

    const handleShowComparison = () => {
        if (!userLastResult || !aiLastResult) return;
        setShowComparison(true);
    };

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
                    coords: parsed.coords || [-0.3763, 39.4699],
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
            const fallback = {coords: [-0.3763, 39.4699], zoom: 10, initialStability: 60};
            setSetup(fallback);
            setCurrentTime(new Date());
        }

    }, []);

    useEffect(() => {
    const saved = window.localStorage.getItem("resources");
    if (!saved) return;

    try {
        // rawResources is: [ { "Medical Resources": {...}, "Logistics & Support": {...} } ]
        const rawResources = JSON.parse(saved);
        // Turn that into [{category, items:[{name, available, total, icon},…]}, …]
        const formatted = rawResources.flatMap(groupObj =>
        Object.entries(groupObj).map(([category, itemsObj]) => ({
            category,
            items: Object.entries(itemsObj).map(([name, available]) => ({
            name,
            available,
            total: available,
            icon: ""          // or supply an icon if you have one
            }))
        }))
        );

        console.log("Transformed resources:", formatted);
        setResources(formatted);
    } catch (e) {
        console.error("Failed to parse or transform resources:", e);
    }
    }, []);

    useEffect(() => {
        if (turnsLeft === 0) {
            setGameCondition('lost');
            navigate('/results', {replace: true});
        }
    }, [turnsLeft, setGameCondition, navigate]);

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

    function generateRandomCoordinates(center, radiusKm) {
        const [centerLng, centerLat] = center;
        const radiusInMeters = radiusKm * 1000;
        const y0 = centerLat * Math.PI / 180;
        const x0 = centerLng * Math.PI / 180;

        const rand = Math.random();
        const rand2 = Math.random();
        const w = radiusInMeters * Math.sqrt(rand);
        const t = 2 * Math.PI * rand2;

        const dx = w * Math.cos(t);
        const dy = w * Math.sin(t);

        const newLat = (y0 + dy / 6378137) * 180 / Math.PI;
        const newLng = (x0 + dx / (6378137 * Math.cos(y0))) * 180 / Math.PI;
        return [newLng, newLat];
    }

    useEffect(() => {
        if (!map || !bubbles.length || !setup?.coords) return;

        const markers = [];

        bubbles.forEach(b => {
            const coords = b.coordinates || generateRandomCoordinates(setup.coords, 10);

            const el = document.createElement('div');
            el.className = 'custom-marker';

            el.style.width = '60px';
            el.style.height = '60px';
            el.style.backgroundImage = `url(${alertIcon})`;
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.backgroundPosition = 'center';
            el.style.cursor = 'pointer';

            el.addEventListener('click', () => {
                setSelectedBubble(b);
            });

            const marker = new maplibregl.Marker({
                element: el,
                anchor: 'center'
            })
                .setLngLat(coords)
                .addTo(map);

            markers.push(marker);
        });

        return () => markers.forEach(m => m.remove());
    }, [map, bubbles, setup?.coords]);


useEffect(() => {
fetchInitialBubbles(localStorage.getItem('location')
)
    .then(data => {
      // 1️⃣ grab the “most potential threat” if you want it as bubble #0
      const mpt = data.threats.most_potential_threat;
      const initialBubble = {
        index:       0,
        title:       mpt.name,
        description: mpt.threat_description,
        visible:     true
      };

      // 2️⃣ now map each day → one bubble
      const dailyBubbles = data.threats.daily_threats.map(day => ({
        index:       day.day,                                           // 1 through 7
        title:       `Infrastructure issues`,
        description: day.critical_infrastructure_problems.join('  '),   // join the strings
        visible:     false
      }));

      // 3️⃣ combine and set
      setBubbles([ initialBubble, ...dailyBubbles ]);

      // 4️⃣ stash your session_id
      localStorage.setItem('session_id', data.session_id);
    })
    .catch(console.error);
}, []);

const handleSubmit = async () => {
  if (!inputValue.trim()) return;

  // grab the *string* you stored under "sessionId"
  const session_id = localStorage.getItem('session_id');
  if (!session_id) {
    console.error("No sessionId in storage");
    return;
  }

  try {
    // Pass the sessionId string *first*, then the user’s prompt directly
    const result = await submitGameAction(session_id, inputValue);

    setCrisisStability(result.severity_score * 10);
    const formatted = Object.entries(result.updated_resources).map(
    ([category, itemsObj]) => ({
        category,
        items: Object.entries(itemsObj).map(
        ([name, available]) => ({
            name,
            available,
            total: available,   // or preserve an earlier total if you have it
            icon: ""            // or carry over whatever icon lookup you use
        })
        )
    })
    );

    setResources(formatted);
    setUserLastResult({
    userInput: inputValue,
          updated_resources: result.updated_resources,
    ...result.analysis
    });

    setAiLastResult(result.analysis.alternative_solutions);
    setShowResult(true);


    setCrisisStability(result.severity_score * 10);

    console.log("User action submitted:", result.analysis.alternative_solutions);
    console.log("AI action submitted:", result.analysis.alternative_solutions);

    setMessages(prev => [
      ...prev,
      {
        type: 'action',
        title: setup.description,
        action: inputValue,
        resultText: result.analysis.short_response,
        feedback: result.analysis.feedback,
        effectiveness: result.analysis.response_analysis.overall_effectiveness,
        time: new Date()
      },
    ]);
    console.log("User action submitted:", result);
    console.log("AI action submitted:", result.analysis.short_response);
    console.log("AI action submitted:", result.analysis.feedback);
    console.log("AI action submitted:", result.analysis.response_analysis.overall_effectiveness);
    console.log("AI action submitted:", result.analysis.alternative_solutions);

    setTurnsLeft(prev => Math.max(prev - 1, 0));
  } catch (err) {
    console.error("submitGameAction failed:", err);
  }


  setInputValue('');
};

    useEffect(() => {
  if (!userLastResult) return;
  // e.g. if you wanted to push userLastResult.updated_resources back into localStorage:
  localStorage.setItem(
    "resources",
    JSON.stringify([ userLastResult.updated_resources ])
  );
}, [userLastResult]);

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
                    {resources.map((group) => (
                        <React.Fragment key={group.category}>
                        <li
                            className="resource-header"
                            style={{ background: groupBg }}
                        >
                            📦 {group.category}
                        </li>
                        {/*
                            Each `group.items` now comes from your latest
                            `userLastResult.updated_resources` via localStorage
                        */}
                        {group.items.map((item) => (
                            <li
                            key={`${group.category}-${item.name}`}
                            className="resource-item"
                            >
                            <span className="name">{item.name}</span>
                            <span className="count">
                                {item.available} / {item.total} available
                            </span>
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
                        {selectedBubble ? (
                            <>
                                <h4>{selectedBubble.title}</h4>
                                <p>{selectedBubble.description}</p>
                            </>
                        ) : (
                            <>
                                <h4>Please, chooose the issue on a map</h4>
                                <p>Then, try to solve in the nest way</p>
                            </>
                        )}
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
                                                    style={{width: `${m.effectiveness*10}%`, background: groupBg}}
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
                        className="ai-simulation-btn"
                        style={{background: groupBg}}
                        disabled={!hasUserAction}
                        onClick={handleShowComparison}
                    >
                        Run AI Simulation
                    </button>
                </div>
            )}

            {showResult && userLastResult && (
                <div className="result-modal-backdrop">
                    <div className="result-modal">
                        <header className="res-header" style={{background: groupBg}}>
                            <h2>Response Summary</h2>
                            <button className="res-close" onClick={() => setShowResult(false)}>×</button>
                        </header>
                        <div className="res-body">
                            <h3>{userLastResult.short_response}</h3>

                            <div className="res-feedback">
                                <strong>Feedback:</strong>
                                <p>{userLastResult.feedback}</p>
                            </div>

                            {
                            userLastResult.response_analysis &&
                            Object.keys(userLastResult.response_analysis).length > 0 && (
                                <div className="res-analysis">
                                <h4>Response Analysis</h4>
                                {Object.entries(userLastResult.response_analysis).map(
                                    ([category, score], i) => (
                                    <div key={i} className="analysis-item">
                                        <span className="label">
                                        {category
                                            .split('_')
                                            .map(w => w[0].toUpperCase() + w.slice(1))
                                            .join(' ')}
                                        </span>
                                        <span className="score">{score} / 10</span>
                                        <div className="bar">
                                        <div
                                            className="fill"
                                            style={{
                                            width: `${score * 10}%`,
                                            background: groupBg
                                            }}
                                        />
                                        </div>
                                    </div>
                                    )
                                )}
                                </div>
                            )
                            }
                        </div>
                    </div>
                </div>
            )}

            {showComparison && (
                <div className="comparison-modal-backdrop">
                    <div className="comparison-modal">
                        <header className="cmp-header">
                            <h2>Human vs. AI Response Comparison</h2>
                            <button className="cmp-close" onClick={() => setShowComparison(false)}>×</button>
                        </header>
                        <div className="cmp-event-row">
                            Event: {setup.description}
                        </div>
                        <div className="cmp-summary">
                            <div className="cmp-subtitle">Effectiveness Comparison</div>
                            <div className="cmp-scores">
                                <div className="score-block">
                                    <strong>Your Response</strong>
                                    <span className="score" style={{color: groupBg}}>
                                        {userLastResult.response_analysis.overall_effectiveness} / 10
                                    </span>
                                </div>
                                <div className="score-block">
                                    <strong>AI Response</strong>
                                    <span className="score" style={{color: groupBg}}>
                                        {aiLastResult.response_analysis.overall_effectiveness} / 10
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="cmp-body">
                            <div className="cmp-col">
                                <h4>Your Response</h4>
                                <p className="cmp-text">{userLastResult.userInput}</p>
                                <p className="cmp-result">Result: {userLastResult.short_response}</p>
                                <p className="cmp-feedback">{userLastResult.feedback}</p>
                            </div>
                            <div className="cmp-col">
                                <h4>AI Response</h4>
                                <p className="cmp-text">{aiLastResult.solution}</p>
                                <p className="cmp-result">Result: {aiLastResult.alternative_result}</p>
                                <p className="cmp-feedback">{aiLastResult.feedback}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
