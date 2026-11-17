const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function apiGet(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}
