import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { Marked } from 'marked';
import { build as bundle } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const sections = ['home', 'publications', 'awards', 'service'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    char =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  );
}

/** Only these links become custom events. Repository/footer links are not profiles. */
export function classifyLink(href, publicationId = '') {
  const url = new URL(href, 'https://www.dengkaixin.com');
  if (url.protocol === 'mailto:') return { event: 'contact_click', data: {} };
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (publicationId) {
    let linkType = 'paper';
    if (url.hostname === 'github.com') linkType = 'code';
    else if (url.hostname === 'arxiv.org') linkType = 'preprint';
    else if (url.hostname === 'xueshu.baidu.com') linkType = 'patent';
    else if (url.hostname.endsWith('.github.io')) linkType = 'project';
    return {
      event: 'publication_click',
      data: { publication_id: publicationId, link_type: linkType },
    };
  }
  if (url.hostname === 'github.com' && /^\/dkx2077\/?$/.test(url.pathname)) {
    return { event: 'profile_click', data: { platform: 'github' } };
  }
  if (url.hostname === 'scholar.google.com' && url.searchParams.get('user') === 'WsJD-ukAAAAJ') {
    return { event: 'profile_click', data: { platform: 'google_scholar' } };
  }
  return null;
}

export function renderMarkdown(markdown, publicationId = '') {
  const parser = new Marked({ gfm: true, breaks: true });
  parser.use({
    renderer: {
      link(href, title, text) {
        const url = new URL(href, 'https://www.dengkaixin.com');
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return text;
        const external = /^https?:/.test(href) && url.hostname !== 'www.dengkaixin.com';
        const tracking = href.startsWith('#') ? null : classifyLink(href, publicationId);
        const attrs = [`href="${escapeHtml(href)}"`];
        if (title) attrs.push(`title="${escapeHtml(title)}"`);
        if (external) attrs.push('target="_blank" rel="noopener noreferrer"');
        if (tracking) {
          attrs.push(`data-track-event="${tracking.event}"`);
          for (const [key, value] of Object.entries(tracking.data)) {
            attrs.push(`data-${key.replaceAll('_', '-')}="${escapeHtml(value)}"`);
          }
        }
        return `<a ${attrs.join(' ')}>${text}</a>`;
      },
    },
  });
  return parser.parse(markdown);
}

/** Explicit stable IDs survive edits to titles, ordering and publisher URLs. */
export function renderPublications(markdown) {
  const blocks = markdown.split(/<!-- publication: ([a-z0-9-]+) -->/g);
  if (blocks.length === 1) throw new Error('Publications must have publication ID markers.');
  let html = renderMarkdown(blocks[0]);
  const ids = new Set();
  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i];
    if (ids.has(id)) throw new Error(`Duplicate publication ID: ${id}`);
    ids.add(id);
    html += `<article class="publication" id="publication-${id}">\n${renderMarkdown(blocks[i + 1], id)}</article>\n`;
  }
  return html;
}

export function analyticsTag(websiteId, siteUrl, assetVersion, required = false) {
  const id = String(websiteId || '').trim();
  if (!id) {
    if (required)
      throw new Error(
        'Set UMAMI_WEBSITE_ID or contents/config.yml umami-website-id before deployment.'
      );
    return '';
  }
  if (!uuid.test(id))
    throw new Error('Umami Website ID must be a UUID from the Cloud tracking code.');
  const domain = new URL(siteUrl).hostname;
  return `<script defer src="static/js/analytics.js?v=${assetVersion}" data-website-id="${id}" data-domain="${escapeHtml(domain)}"></script>`;
}

export async function build() {
  const config = yaml.load(await readFile(resolve(root, 'contents/config.yml'), 'utf8'));
  const sceneConfig = yaml.load(await readFile(resolve(root, 'contents/scene.yml'), 'utf8'));
  const template = await readFile(resolve(root, 'templates/index.html'), 'utf8');
  const sources = await Promise.all(
    sections.map(name => readFile(resolve(root, `contents/${name}.md`), 'utf8'))
  );
  const assets = await Promise.all(
    [
      'css/main.css',
      'js/navigation.js',
      'js/analytics.js',
      'js/math.js',
      'js/experience.mjs',
      'js/scene/world.mjs',
      'js/scene/environment.mjs',
      'js/scene/signs.mjs',
      'js/scene/look.mjs',
      'js/scene/design.mjs',
      'js/scene/lighting.mjs',
    ].map(path => readFile(resolve(root, 'static', path)))
  );
  const version = createHash('sha256').update(Buffer.concat(assets)).digest('hex').slice(0, 12);
  const values = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, escapeHtml(value)])
  );
  for (const [key, value] of Object.entries(sceneConfig))
    values[`scene-${key}`] = escapeHtml(value);
  const pitchMin = Number(sceneConfig['pitch-min']);
  const pitchMax = Number(sceneConfig['pitch-max']);
  if (
    !Number.isFinite(pitchMin) ||
    !Number.isFinite(pitchMax) ||
    pitchMin < -60 ||
    pitchMax > 70 ||
    pitchMin >= pitchMax
  ) {
    throw new Error('Scene pitch limits must be ordered and within -60 to 70 degrees.');
  }
  if (!['auto', 'low', 'high'].includes(sceneConfig.quality))
    throw new Error('Invalid scene quality.');
  values['scene-settings'] = JSON.stringify({
    pitchMin,
    pitchMax,
    quality: sceneConfig.quality,
  }).replaceAll('<', '\\u003c');
  values['publication-count'] = String(
    (sources[1].match(/<!-- publication: /g) || []).length
  ).padStart(2, '0');
  values['asset-version'] = version;
  values.analytics = analyticsTag(
    process.env.UMAMI_WEBSITE_ID || config['umami-website-id'],
    config.url,
    version,
    process.env.REQUIRE_ANALYTICS === 'true'
  );
  // No formula library is downloaded unless the authored content contains TeX delimiters.
  values.math = sources.some(source => /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(source))
    ? `<script defer src="static/js/math.js?v=${version}"></script>`
    : '';
  sections.forEach((name, i) => {
    values[name] =
      name === 'publications'
        ? renderPublications(sources[i])
        : renderMarkdown(
            name === 'service' && sources[i].trim() === '...'
              ? 'No ongoing work has been listed.'
              : sources[i]
          );
  });
  const html = template.replace(/\{\{([a-z-]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Missing template value: ${key}`);
    return values[key];
  });
  // Validate everything before replacing the disposable deployment output.
  await rm(resolve(root, 'dist'), { recursive: true, force: true });
  await mkdir(resolve(root, 'dist'), { recursive: true });
  await cp(resolve(root, 'static'), resolve(root, 'dist/static'), { recursive: true });
  // Ship pinned, bundled modules locally; visitors never depend on a Three.js CDN.
  await bundle({
    entryPoints: [resolve(root, 'static/js/experience.mjs')],
    outdir: resolve(root, 'dist/static/js'),
    bundle: true,
    splitting: true,
    format: 'esm',
    target: ['es2020'],
    minify: true,
    entryNames: 'experience',
    chunkNames: 'chunks/[name]-[hash]',
    legalComments: 'linked',
  });
  await rm(resolve(root, 'dist/static/js/scene'), { recursive: true, force: true });
  await rm(resolve(root, 'dist/static/js/experience.mjs'), { force: true });
  await cp(resolve(root, 'CNAME'), resolve(root, 'dist/CNAME'));
  await writeFile(resolve(root, 'dist/.nojekyll'), '');
  await writeFile(resolve(root, 'dist/index.html'), html);
  console.log(
    `Built dist/index.html. Analytics ${values.analytics ? 'configured' : 'disabled (no Website ID)'}.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
