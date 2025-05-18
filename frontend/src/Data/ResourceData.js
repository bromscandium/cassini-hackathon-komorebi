// src/Components/ResourceData.js
export default function ResourceData({ resources = [] }) {
  if (!resources.length) return <p>No resources yet.</p>;
  return <pre>{JSON.stringify(resources, null, 2)}</pre>;
}
