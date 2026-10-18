export async function readApiJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Server returned an empty response (HTTP ${response.status})`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`Server returned an invalid response (HTTP ${response.status})`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Server returned an invalid response (HTTP ${response.status})`);
  }
  return payload as Record<string, unknown>;
}
