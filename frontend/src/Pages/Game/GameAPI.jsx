const API_BASE = 'http://localhost:8000';


export async function fetchInitialBubbles(location) {
  const response = await fetch(`${API_BASE}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location:  location,
    }),
  });
  if (!response.ok) {
    throw new Error(await response.text() || response.status);
  }
  return response.json();
}


export async function submitGameAction(session_id, solution) {
  if (!session_id) {
    throw new Error('No sessionId found in localStorage');
  }

  const response = await fetch(`${API_BASE}/session/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id,
      solution,   // must match SolveRequest.solution
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text() || response.status);
  }
  return response.json();
}
