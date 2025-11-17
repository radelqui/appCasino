#!/usr/bin/env node

/**
 * Script de prueba local para CodeWiki sync
 * Permite testear la conversión sin hacer push a GitHub
 */

const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

async function findMarkdownFiles(dir = '.', files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!['node_modules', '.git', '.github', 'dist', 'build'].includes(entry.name)) {
        await findMarkdownFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function markdownToCleanHtml(markdown) {
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true,
  });

  const html = marked.parse(markdown);

  return html
    .replace(/<pre><code class="language-(\w+)">/g, '<pre><code>')
    .replace(/<pre><code>/g, '<pre style="background:#f4f4f4;padding:10px;border-radius:5px;"><code>')
    .replace(/<\/code><\/pre>/g, '</code></pre>')
    .replace(/<table>/g, '<table border="1" cellpadding="5" cellspacing="0">')
    .trim();
}

async function testConversion(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath, '.md');
  const relativePath = path.relative('.', filePath);

  console.log(`\n📄 Processing: ${relativePath}`);
  console.log(`   Size: ${content.length} bytes`);

  const htmlContent = markdownToCleanHtml(content);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `.trim();

  // Guardar preview
  const outputPath = path.join('.github', 'scripts', 'preview', `${fileName}.html`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, fullHtml);

  console.log(`   ✅ Preview saved: ${outputPath}`);
  return outputPath;
}

async function main() {
  console.log('🧪 CodeWiki Local Test\n');

  try {
    const markdownFiles = await findMarkdownFiles(process.cwd());
    console.log(`Found ${markdownFiles.length} Markdown files`);

    if (markdownFiles.length === 0) {
      console.log('⚠ No Markdown files found');
      return;
    }

    const previews = [];
    for (const file of markdownFiles) {
      try {
        const preview = await testConversion(file);
        previews.push(preview);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
    }

    console.log(`\n✅ Generated ${previews.length} preview files`);
    console.log(`\n📂 View previews in: .github/scripts/preview/`);
    console.log(`   Open the .html files in your browser to see how they'll look`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
