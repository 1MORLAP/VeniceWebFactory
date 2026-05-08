import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load order: .env.local FIRST (gitignored — secrets go here), then .env
// (committed defaults / non-secret config). dotenv doesn't override values
// already in process.env, so .env.local wins for any var present in both.
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });
