const API_BASE = 'http://localhost:8000';

export async function sendGameSetup(data, file) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => formData.append(key, value));
  if (file) formData.append("file", file);

  const response = await fetch(`${API_BASE}/extract/excel`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error(await response.text());

  const json = await response.json();
  return json.resources;        // ← only return the array
}
