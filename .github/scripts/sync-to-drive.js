#!/usr/bin/env node

/**
 * CodeWiki → NotebookLM Sync Script
 * Convierte archivos Markdown a Google Docs y los sube a Drive
 */

const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const { marked } = require('marked');

// Configuración
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents'
];

/**
 * Inicializa el cliente de Google Drive
 */
async function initGoogleDrive() {
  const credentials = JSON.parse(
    await fs.readFile('credentials.json', 'utf8')
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  return { drive, docs, auth };
}

/**
 * Encuentra todos los archivos .md en el repositorio
 */
async function findMarkdownFiles(dir = '.', files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Ignorar directorios comunes
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

/**
 * Convierte Markdown a HTML limpio
 */
function markdownToCleanHtml(markdown) {
  // Configurar marked para output limpio
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true,
    headerIds: true,
  });

  const html = marked.parse(markdown);

  // Limpiar el HTML para Google Docs
  return html
    .replace(/<pre><code class="language-(\w+)">/g, '<pre><code>')
    .replace(/<pre><code>/g, '<pre style="background:#f4f4f4;padding:10px;border-radius:5px;"><code>')
    .replace(/<\/code><\/pre>/g, '</code></pre>')
    .replace(/<table>/g, '<table border="1" cellpadding="5" cellspacing="0">')
    .trim();
}

/**
 * Obtiene o crea la carpeta del repositorio en Drive
 */
async function getOrCreateRepoFolder(drive, parentFolderId, repoName) {
  // Buscar carpeta existente
  const response = await drive.files.list({
    q: `name='${repoName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Crear carpeta nueva
  const folder = await drive.files.create({
    requestBody: {
      name: repoName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  });

  return folder.data.id;
}

/**
 * Sube un archivo Markdown como Google Doc
 */
async function uploadMarkdownAsGoogleDoc(drive, filePath, folderId, repoName) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath, '.md');
  const relativePath = path.relative('.', filePath);

  console.log(`📄 Processing: ${relativePath}`);

  // Convertir a HTML
  const htmlContent = markdownToCleanHtml(content);

  // Preparar el HTML completo
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
    h3 { color: #555; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    a { color: #3498db; text-decoration: none; }
    a:hover { text-decoration: underline; }
    blockquote { border-left: 4px solid #3498db; margin: 20px 0; padding-left: 20px; color: #555; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #3498db; color: white; }
  </style>
</head>
<body>
  <p><em>📁 Repo: ${repoName} | 📄 File: ${relativePath}</em></p>
  <hr>
  ${htmlContent}
  <hr>
  <p><small>🤖 Auto-generated from GitHub | Last sync: ${new Date().toISOString()}</small></p>
</body>
</html>
  `.trim();

  // Buscar si ya existe el archivo
  const searchResponse = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: 'files(id, name)',
  });

  let fileId;

  if (searchResponse.data.files.length > 0) {
    // Actualizar archivo existente
    fileId = searchResponse.data.files[0].id;
    console.log(`  ↻ Updating existing doc: ${fileId}`);

    // Para actualizar, necesitamos eliminar y recrear
    await drive.files.delete({ fileId });

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
      },
      media: {
        mimeType: 'text/html',
        body: fullHtml,
      },
      fields: 'id, webViewLink',
    });

    fileId = createResponse.data.id;
    console.log(`  ✅ Updated: ${createResponse.data.webViewLink}`);
  } else {
    // Crear nuevo archivo
    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
      },
      media: {
        mimeType: 'text/html',
        body: fullHtml,
      },
      fields: 'id, webViewLink',
    });

    fileId = createResponse.data.id;
    console.log(`  ✅ Created: ${createResponse.data.webViewLink}`);
  }

  return fileId;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting CodeWiki → NotebookLM Sync\n');

  try {
    // Inicializar Google Drive
    const { drive } = await initGoogleDrive();
    console.log('✓ Google Drive authenticated\n');

    // Obtener configuración
    const parentFolderId = process.env.GOOGLE_FOLDER_ID;
    const repoName = process.env.REPO_NAME || 'unknown-repo';

    if (!parentFolderId) {
      throw new Error('GOOGLE_FOLDER_ID environment variable not set');
    }

    // Crear/obtener carpeta del repo
    const repoFolderId = await getOrCreateRepoFolder(drive, parentFolderId, repoName);
    console.log(`✓ Repository folder ready: ${repoFolderId}\n`);

    // Encontrar archivos Markdown
    const markdownFiles = await findMarkdownFiles();
    console.log(`Found ${markdownFiles.length} Markdown files\n`);

    if (markdownFiles.length === 0) {
      console.log('⚠ No Markdown files found');
      return;
    }

    // Procesar cada archivo
    const results = [];
    for (const file of markdownFiles) {
      try {
        const fileId = await uploadMarkdownAsGoogleDoc(drive, file, repoFolderId, repoName);
        results.push({ file, fileId, success: true });
      } catch (error) {
        console.error(`  ❌ Error processing ${file}:`, error.message);
        results.push({ file, error: error.message, success: false });
      }
    }

    // Resumen
    console.log('\n📊 Sync Summary:');
    console.log(`  ✅ Success: ${results.filter(r => r.success).length}`);
    console.log(`  ❌ Failed: ${results.filter(r => !r.success).length}`);
    console.log(`\n🎉 Sync completed! Your docs are ready in NotebookLM`);
    console.log(`   Open: https://drive.google.com/drive/folders/${repoFolderId}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { main };
