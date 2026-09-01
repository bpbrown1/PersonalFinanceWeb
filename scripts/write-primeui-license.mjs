import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const localLicensePath = resolve(projectRoot, '.primeui-license');
const generatedLicensePath = resolve(projectRoot, 'public', 'primeui-license.js');

async function readLicense() {
  const environmentLicense = process.env.PRIMEUI_LICENSE?.trim();
  if (environmentLicense) return environmentLicense;

  try {
    return (await readFile(localLicensePath, 'utf8')).trim();
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        'PrimeUI license not found. Set PRIMEUI_LICENSE or create .primeui-license in the project root.',
      );
    }
    throw error;
  }
}

const license = await readLicense();
if (!license) throw new Error('The PrimeUI license is empty.');

await mkdir(resolve(projectRoot, 'public'), { recursive: true });
await writeFile(generatedLicensePath, `window.__primeUiLicense = ${JSON.stringify(license)};\n`, {
  mode: 0o600,
});

console.log('PrimeUI runtime license file generated.');
