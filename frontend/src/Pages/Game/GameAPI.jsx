const API_BASE = 'http://localhost:8000'

export async function submitGameAction(payload) {
    const response = await fetch(`${API_BASE}/api/game-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: payload.text,
            timestamp: payload.timestamp
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `Server error ${response.status}`);
    }
    return await response.json();
}