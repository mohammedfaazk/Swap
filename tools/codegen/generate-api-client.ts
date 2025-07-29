import { writeFileSync } from 'fs';
import path from 'path';

async function generateApiClient() {
  // Basic example generating fetch wrappers or similar from OpenAPI or GraphQL schema
  const apiClientPath = path.resolve(__dirname, '../../frontend/src/lib/apiClient.ts');
  const content = `export async function fetchSwapStatus(swapId: string) {
  const resp = await fetch(\`/api/v1/swaps/\${swapId}\`);
  if (!resp.ok) throw new Error('Failed to fetch swap status');
  return resp.json();
}

export async function initiateSwap(payload: any) {
  const resp = await fetch('/api/v1/swaps/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error('Failed to initiate swap');
  return resp.json();
}
`;
  writeFileSync(apiClientPath, content, 'utf-8');
  console.log('API client generated.');
}

generateApiClient().catch(console.error);
