// Pulls SMBKE (app) truth into this hub at build time.
// Generates Solux_Platform_Live.html from selected SMBKE markdown docs.
// Does NOT rewrite hand-authored hub docs (BA, AI Initiatives, Working Doc, App Map).
//
// Sources (first match wins):
//   1. SMBKE_LOCAL_PATH env, or auto-detected sibling checkout
//   2. GitHub API (needs GITHUB_TOKEN / SMBKE_GITHUB_TOKEN — repo is private)
//
// Env:
//   SMBKE_GITHUB_REPO   default Ngamei/SMBKE
//   SMBKE_GITHUB_REF    default main
//   SMBKE_LOCAL_PATH    optional absolute path to a local SMBKE checkout
//   GITHUB_TOKEN or SMBKE_GITHUB_TOKEN

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT_FILE = path.join(ROOT, 'Solux_Platform_Live.html');

const REPO = process.env.SMBKE_GITHUB_REPO || 'Ngamei/SMBKE';
const REF = process.env.SMBKE_GITHUB_REF || 'main';
const TOKEN =
  process.env.SMBKE_GITHUB_TOKEN ||
  process.env.GITHUB_TOKEN ||
  '';

/** SMBKE paths → tab id / title on the live page */
const SOURCES = [
  {
    id: 'overview',
    title: 'Product overview',
    path: 'docs/current-implementation/PRODUCT_OVERVIEW.md',
  },
  {
    id: 'roles',
    title: 'Roles & access',
    path: 'docs/current-implementation/USER_ROLES.md',
  },
  {
    id: 'lifecycle',
    title: 'Order lifecycle',
    path: 'docs/current-implementation/ORDER_LIFECYCLE.md',
  },
  {
    id: 'next',
    title: 'App next steps',
    path: 'docs/ai/NEXT_STEPS.md',
  },
];

function resolveLocalRoot() {
  if (process.env.SMBKE_LOCAL_PATH) {
    return process.env.SMBKE_LOCAL_PATH;
  }
  const candidates = [
    path.resolve(ROOT, '../../SMBKE'),
    path.resolve(ROOT, '../../../SMBKE'),
    path.resolve(ROOT, '../SMBKE'),
  ];
  return candidates.find((p) => fs.existsSync(path.join(p, 'package.json'))) || null;
}

async function githubFetch(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'solux-hub-smbke-sync',
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${url} — ${body.slice(0, 200)}`);
  }
  return res;
}

async function fetchFromGitHub(filePath) {
  const url =
    `https://api.github.com/repos/${REPO}/contents/${filePath}` +
    `?ref=${encodeURIComponent(REF)}`;
  const res = await githubFetch(url);
  const json = await res.json();
  if (!json.content) throw new Error(`No content for ${filePath}`);
  return Buffer.from(json.content, 'base64').toString('utf8');
}

async function fetchCommitMeta() {
  const url = `https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(REF)}`;
  const res = await githubFetch(url);
  const json = await res.json();
  return {
    sha: (json.sha || '').slice(0, 7),
    fullSha: json.sha || '',
    date: (json.commit && json.commit.committer && json.commit.committer.date) || '',
    message: (json.commit && json.commit.message || '').split('\n')[0],
    source: `github:${REPO}@${REF}`,
  };
}

function fetchFromLocal(localRoot, filePath) {
  const full = path.join(localRoot, filePath);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing local file: ${full}`);
  }
  return fs.readFileSync(full, 'utf8');
}

function localCommitMeta(localRoot) {
  try {
    const { execSync } = require('child_process');
    const sha = execSync('git rev-parse --short HEAD', {
      cwd: localRoot,
      encoding: 'utf8',
    }).trim();
    const fullSha = execSync('git rev-parse HEAD', {
      cwd: localRoot,
      encoding: 'utf8',
    }).trim();
    const date = execSync('git log -1 --format=%cI', {
      cwd: localRoot,
      encoding: 'utf8',
    }).trim();
    const message = execSync('git log -1 --format=%s', {
      cwd: localRoot,
      encoding: 'utf8',
    }).trim();
    const branch = execSync('git branch --show-current', {
      cwd: localRoot,
      encoding: 'utf8',
    }).trim();
    return {
      sha,
      fullSha,
      date,
      message,
      source: `local:${localRoot} (${branch || 'detached'})`,
    };
  } catch {
    return {
      sha: 'unknown',
      fullSha: '',
      date: new Date().toISOString(),
      message: '',
      source: `local:${localRoot}`,
    };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal Markdown → HTML (good enough for SMBKE current-implementation docs). */
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;
  let inCode = false;
  let codeLang = '';
  let para = [];

  function closeLists() {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  }

  function flushPara() {
    if (!para.length) return;
    const text = para.join(' ').trim();
    if (text) out.push(`<p>${inline(text)}</p>`);
    para = [];
  }

  function inline(text) {
    let t = escapeHtml(text);
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    t = t.replace(
      /\[([^\]]+)\]\((https?:[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
    return t;
  }

  for (const raw of lines) {
    const line = raw;

    if (line.startsWith('```')) {
      flushPara();
      closeLists();
      if (inCode) {
        out.push('</code></pre>');
        inCode = false;
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.slice(3).trim();
        out.push(
          `<pre class="md-code"${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ''}><code>`
        );
      }
      continue;
    }

    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushPara();
      closeLists();
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushPara();
      closeLists();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      closeLists();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushPara();
      closeLists();
      out.push('<hr />');
      continue;
    }

    closeLists();
    para.push(line.trim());
  }

  flushPara();
  closeLists();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

function renderPage(sections, meta) {
  const syncedAt = new Date().toISOString();
  const nav = sections
    .map(
      (s, i) =>
        `<a href="#${s.id}"${i === 0 ? ' class="active"' : ''}>${escapeHtml(s.title)}</a>`
    )
    .join('\n        ');

  const bodies = sections
    .map(
      (s) => `
  <section class="sec" id="${s.id}">
    <div class="sec-meta">
      <span class="path">${escapeHtml(s.path)}</span>
    </div>
    <div class="md">
${s.html}
    </div>
  </section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Solux — Platform Live (from SMBKE)</title>
<meta name="generator" content="sync-smbke.js" />
<style>
:root{
  --beige:#F8F5F0; --white:#FFFFFF; --charcoal:#1C2030;
  --navy:#1C3254; --steel:#4A6FA5; --mist:#C8D4E3; --bdr:#D8D4CC;
  --doc-accent:#3B4A63; --doc-accent-bg:rgba(59,74,99,.09); --doc-accent-bdr:rgba(59,74,99,.28);
  --c86:rgba(28,32,48,.86); --c68:rgba(28,32,48,.68);
  --c48:rgba(28,32,48,.48); --c32:rgba(28,32,48,.32);
  --c16:rgba(28,32,48,.16); --c08:rgba(28,32,48,.08);
  --sb:220px; --topbar:34px;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Helvetica Neue",Arial,sans-serif;font-size:14px;color:var(--charcoal);background:var(--beige);line-height:1.65;}
.topbar{position:sticky;top:0;z-index:200;background:var(--charcoal);height:var(--topbar);display:flex;align-items:center;justify-content:space-between;padding:0 16px;}
.topbar-back{color:#B8C8DC;font-size:0.72rem;font-weight:600;text-decoration:none;letter-spacing:0.04em;}
.topbar-back:hover{color:#fff;}
.topbar-doc{font-size:0.68rem;color:rgba(255,255,255,.30);letter-spacing:0.08em;text-transform:uppercase;}
#sidebar{position:fixed;right:0;top:0;width:var(--sb);height:100vh;background:#EDEAE4;overflow-y:auto;z-index:100;padding-top:var(--topbar);border-left:1px solid var(--bdr);display:flex;flex-direction:column;}
#sidebar .sb-title{background:var(--bdr);padding:8px 14px;color:var(--navy);font-size:0.64rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;}
#sidebar a{display:block;padding:7px 14px;color:var(--c86);text-decoration:none;font-size:0.74rem;border-left:2px solid transparent;}
#sidebar a:hover,#sidebar a.active{background:rgba(28,32,48,.05);color:var(--navy);border-left-color:var(--doc-accent);}
#sidebar .hub-link{margin-top:auto;border-top:1px solid var(--bdr);background:#fff;padding:6px 0;}
#sidebar .hub-link a{color:var(--steel);}
#main{margin-right:var(--sb);}
.hdr{background:#fff;padding:14px 18px 12px;border-bottom:3px solid var(--doc-accent);}
.hdr-title{color:var(--navy);font-size:1rem;font-weight:700;}
.hdr-sub{color:var(--steel);font-size:0.73rem;margin-top:2px;}
.banner{background:#FFF9EF;border-bottom:1px solid #f0c87a;padding:10px 18px;font-size:0.78rem;color:var(--c86);}
.banner strong{color:#8B4A00;}
.banner code{background:var(--beige);border:1px solid var(--bdr);border-radius:2px;padding:1px 5px;font-size:0.72rem;}
.meta{display:flex;flex-wrap:wrap;gap:10px 18px;padding:10px 18px;background:#fff;border-bottom:1px solid var(--mist);font-size:0.72rem;color:var(--c68);}
.meta span b{color:var(--navy);font-weight:700;}
.sec{padding:18px 18px 28px;max-width:920px;}
.sec + .sec{border-top:1px solid var(--mist);}
.sec-meta{margin-bottom:10px;}
.sec-meta .path{font-size:0.68rem;color:var(--c48);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.md h1{font-size:1.25rem;color:var(--navy);margin:1.2rem 0 .5rem;}
.md h2{font-size:1.05rem;color:var(--navy);margin:1.1rem 0 .45rem;}
.md h3{font-size:0.92rem;color:var(--navy);margin:1rem 0 .35rem;}
.md h4{font-size:0.85rem;color:var(--steel);margin:.85rem 0 .3rem;}
.md p{margin:.45rem 0;color:var(--c86);}
.md ul,.md ol{margin:.4rem 0 .6rem 1.3rem;color:var(--c86);}
.md li{margin:.2rem 0;}
.md blockquote{margin:.6rem 0;padding:8px 12px;background:#fff;border-left:3px solid var(--steel);color:var(--c68);font-size:0.82rem;}
.md hr{border:none;border-top:1px solid var(--mist);margin:1.2rem 0;}
.md code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.78em;background:rgba(28,32,48,.06);padding:1px 4px;border-radius:2px;}
.md pre.md-code{background:#1C2030;color:#E8EEF6;padding:12px 14px;border-radius:4px;overflow-x:auto;margin:.7rem 0;font-size:0.75rem;line-height:1.5;}
.md pre.md-code code{background:none;padding:0;color:inherit;}
.md a{color:var(--steel);}
@media(max-width:860px){
  #sidebar{display:none;}
  #main{margin-right:0;}
}
</style>
</head>
<body>
<div class="topbar">
  <a class="topbar-back" href="Solux.html">← Hub</a>
  <span class="topbar-doc">Auto-synced from SMBKE</span>
</div>
<aside id="sidebar">
  <div class="sb-title">Live sections</div>
  <nav>
        ${nav}
  </nav>
  <div class="hub-link">
    <a href="Solux.html">← Document hub</a>
    <a href="Solux_Business_Analysis.html#sbm">Business Analysis §4b</a>
  </div>
</aside>
<div id="main">
  <div class="hdr">
    <div>
      <div class="hdr-title">Platform Live — SMBKE truth</div>
      <div class="hdr-sub">Auto-generated at hub build time from the app repo. Hand-authored hub docs are unchanged.</div>
    </div>
  </div>
  <div class="banner">
    <strong>Source of truth:</strong> SMBKE (<code>${escapeHtml(REPO)}</code>).
    This page is rebuilt whenever solux-hub deploys (including after an SMBKE webhook trigger).
    Do not edit this file by hand — run <code>node sync-smbke.js</code> or wait for the next deploy.
  </div>
  <div class="meta">
    <span><b>Commit</b> <code>${escapeHtml(meta.sha || '—')}</code></span>
    <span><b>Ref</b> ${escapeHtml(REF)}</span>
    <span><b>Pulled</b> ${escapeHtml(syncedAt)}</span>
    <span><b>Via</b> ${escapeHtml(meta.source || '—')}</span>
    ${meta.message ? `<span><b>Tip</b> ${escapeHtml(meta.message)}</span>` : ''}
  </div>
${bodies}
</div>
<script>
(function () {
  var links = document.querySelectorAll('#sidebar nav a');
  function setActive() {
    var hash = location.hash.slice(1) || (links[0] && links[0].getAttribute('href').slice(1));
    links.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + hash);
    });
  }
  window.addEventListener('hashchange', setActive);
  setActive();
})();
</script>
</body>
</html>
`;
}

async function loadSections(mode, localRoot) {
  const sections = [];
  for (const src of SOURCES) {
    const md =
      mode === 'local'
        ? fetchFromLocal(localRoot, src.path)
        : await fetchFromGitHub(src.path);
    sections.push({
      id: src.id,
      title: src.title,
      path: src.path,
      html: mdToHtml(md),
    });
    console.log(`Synced: ${src.path}`);
  }
  return sections;
}

async function main() {
  const localRoot = resolveLocalRoot();
  let mode = 'github';
  let meta;

  if (localRoot && !process.env.SMBKE_FORCE_GITHUB) {
    mode = 'local';
    meta = localCommitMeta(localRoot);
    console.log(`Using local SMBKE at ${localRoot}`);
  } else {
    if (!TOKEN) {
      console.error(
        'SMBKE sync failed: private repo needs GITHUB_TOKEN (or SMBKE_GITHUB_TOKEN), ' +
          'or a local checkout via SMBKE_LOCAL_PATH / sibling ../../SMBKE.'
      );
      process.exit(1);
    }
    meta = await fetchCommitMeta();
    console.log(`Using GitHub ${REPO}@${REF} (${meta.sha})`);
  }

  const sections = await loadSections(mode, localRoot);
  const html = renderPage(sections, meta);
  fs.writeFileSync(OUT_FILE, html);
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
