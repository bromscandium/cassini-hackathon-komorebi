const API_BASE = 'http://localhost:8000';

export async function submitGameAction(payload) {
    const response = await fetch(`${API_BASE}/api/game-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            location:        payload.location,
            prompt:          payload.prompt,
            initialStability: payload.initialStability,
            resources:       payload.resources,
            messages:        payload.messages
        }),
    });
    if (!response.ok) throw new Error(await response.text() || response.status);
    return await response.json();
}

export async function runSimulation(payload) {
    const response = await fetch(`${API_BASE}/api/run-simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            location:        payload.location,
            initialStability: payload.initialStability,
            resources:       payload.resources,
            messages:        payload.messages
        }),
    });
    if (!response.ok) throw new Error(await response.text() || response.status);
    return await response.json();
}