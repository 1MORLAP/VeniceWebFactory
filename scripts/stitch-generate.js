// Usage: node scripts/stitch-generate.js <domain>
// Requires: STITCH_API_KEY env var, existing manifest.json from scraper
//
// Creates a Stitch project, generates a screen from the scraped business data,
// downloads the HTML and screenshot to jobs/{domain}/stitch-output/

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import https from 'https';
import http from 'http';

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/stitch-generate.js <domain>');
  console.error('  domain: the domain folder name in jobs/ (e.g., example.com)');
  process.exit(1);
}

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error('Error: STITCH_API_KEY environment variable is not set.');
  process.exit(1);
}

const jobDir = resolve(process.cwd(), 'jobs', domain);
const outDir = join(jobDir, 'stitch-output');

async function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers: {
        'x-goog-api-key': API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        writeFile(destPath, buffer).then(() => resolve(buffer.length)).catch(reject);
      });
    }).on('error', reject);
  });
}

async function run() {
  // Read manifest
  const manifestPath = join(jobDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest found at ${manifestPath}. Run scrape.js first.`);
    process.exit(1);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  // Extract business info from manifest
  const business = {
    name: manifest.pages[0]?.title?.split('|')[0]?.trim() || domain,
    url: manifest.url,
    phone: manifest.footer?.phone?.[0] || manifest.pages.flatMap(p =>
      p.sections?.flatMap(s => s.paragraphs || []) || []
    ).find(p => p.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/))?.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/)?.[0] || '',
    email: manifest.footer?.email?.[0] || '',
    services: manifest.pages.filter(p => p.url !== '/' && p.url !== '/about' && p.url !== '/contact')
      .map(p => p.title.split('|')[0].trim()),
    serviceArea: manifest.pages[0]?.sections?.[0]?.paragraphs?.find(p =>
      p.includes('serve') || p.includes('area') || p.includes('community')
    ) || '',
  };

  console.log('Business:', business.name);
  console.log('Phone:', business.phone);
  console.log('Email:', business.email);
  console.log('Services:', business.services.join(', '));

  // Build the prompt
  const prompt = `Redesign ${business.url} as a modern, premium website for ${business.name}.

Services offered: ${business.services.join(', ')}.
Phone: ${business.phone}. Email: ${business.email}.
${business.serviceArea ? `Service area: ${business.serviceArea}` : ''}

Create a single-page design with these sections:
1. Full-bleed hero with background image, compelling headline, and two CTA buttons (call + get quote)
2. Services section with cards for each service: ${business.services.join(', ')}
3. Trust/why-choose-us section with 3 key differentiators
4. Customer testimonials section
5. FAQ accordion section
6. Contact section with form (name, phone, email, message) and contact details
7. Professional footer with service links, contact info, and copyright

Make it premium, modern, and conversion-optimized. Use a sophisticated color scheme.`;

  console.log('\n--- Creating Stitch project ---');

  // Step 1: Create project
  const project = await fetchJson('https://stitch.googleapis.com/v1/projects', {
    method: 'POST',
    body: { title: `WebFactory - ${domain}` },
  });

  const projectId = project.name?.replace('projects/', '');
  if (!projectId) {
    console.error('Failed to create project:', project);
    process.exit(1);
  }
  console.log('Project ID:', projectId);

  // Step 2: Generate screen via MCP endpoint
  console.log('\n--- Generating design (this may take 30-60 seconds) ---');

  const genResponse = await fetchJson('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'generate_screen_from_text',
        arguments: {
          projectId,
          prompt,
          deviceType: 'DESKTOP',
        },
      },
    },
  });

  // Step 3: Parse response and download assets
  await mkdir(outDir, { recursive: true });

  const content = genResponse.result?.content;
  if (!content || !content[0]?.text) {
    console.error('Generation failed. Response:', JSON.stringify(genResponse).substring(0, 500));
    process.exit(1);
  }

  const inner = JSON.parse(content[0].text);
  const components = inner.outputComponents || [];

  console.log(`Got ${components.length} output components`);

  let screenCount = 0;
  for (const comp of components) {
    // Save design system
    if (comp.designSystem) {
      await writeFile(join(outDir, 'design-system.json'), JSON.stringify(comp.designSystem, null, 2));
      console.log('Saved: design-system.json');
    }

    // Download screen HTML and screenshot
    if (comp.design?.screens) {
      for (const screen of comp.design.screens) {
        const sid = screen.id || `screen-${screenCount}`;

        if (screen.htmlCode?.downloadUrl) {
          const size = await downloadFile(screen.htmlCode.downloadUrl, join(outDir, `${sid}.html`));
          console.log(`Saved: ${sid}.html (${Math.round(size / 1024)}KB)`);
        }

        if (screen.screenshot?.downloadUrl) {
          const size = await downloadFile(screen.screenshot.downloadUrl, join(outDir, `${sid}.png`));
          console.log(`Saved: ${sid}.png (${Math.round(size / 1024)}KB)`);
        }

        screenCount++;
      }
    }

    // Save text response
    if (comp.text) {
      await writeFile(join(outDir, 'generation-notes.txt'), comp.text);
      console.log('Saved: generation-notes.txt');
    }
  }

  // Save metadata
  await writeFile(join(outDir, 'metadata.json'), JSON.stringify({
    projectId,
    domain,
    businessName: business.name,
    phone: business.phone,
    email: business.email,
    services: business.services,
    generatedAt: new Date().toISOString(),
    screenCount,
  }, null, 2));

  console.log(`\nDone! Generated ${screenCount} screen(s) in ${outDir}`);
  console.log('Next: Copy HTML to option-b/public/ and replace placeholder content');
}

run().catch(err => {
  console.error('Stitch generation failed:', err);
  process.exit(1);
});
