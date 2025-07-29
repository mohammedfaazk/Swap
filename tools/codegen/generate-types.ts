import fs from 'fs';
import path from 'path';

async function generateTypes() {
  const typesDir = path.resolve(__dirname, '../../frontend/src/types');
  if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
  }

  // Example: generate token enums from JSON schema or API definition
  const tokenEnum = `export enum TokenSymbol {
  ETH = 'ETH',
  XLM = 'XLM',
  USDC = 'USDC',
}\n`;

  await fs.promises.writeFile(path.join(typesDir, 'tokens.ts'), tokenEnum);
  console.log('Types generated successfully.');
}

generateTypes().catch((e) => {
  console.error('Failed to generate types:', e);
});
