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

export async function fetchInitialBubbles() {
    const res = await fetch(`${API_BASE}/api/bubbles`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

export async function fetchUpdatedBubbles(payload) {
    const res = await fetch(`${API_BASE}/api/bubbles/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

