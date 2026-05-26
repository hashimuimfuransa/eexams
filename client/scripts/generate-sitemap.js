const fs = require('fs');
const path = require('path');

// Static pages
const staticPages = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/marketplace', priority: '0.9', changefreq: 'daily' },
  { url: '/public-exams', priority: '0.8', changefreq: 'daily' },
  { url: '/register', priority: '0.8', changefreq: 'monthly' },
  { url: '/student-register', priority: '0.8', changefreq: 'monthly' },
  { url: '/login', priority: '0.7', changefreq: 'monthly' },
  { url: '/forgot-password', priority: '0.5', changefreq: 'monthly' },
  { url: '/privacy', priority: '0.5', changefreq: 'monthly' },
  { url: '/terms', priority: '0.5', changefreq: 'monthly' },
  { url: '/exam-result', priority: '0.6', changefreq: 'weekly' },
  { url: '/access-code', priority: '0.6', changefreq: 'weekly' },
];

const baseUrl = 'https://www.eexams.net';
const today = new Date().toISOString().split('T')[0];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

// Write to public folder
const publicDir = path.join(__dirname, '../public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(sitemapPath, xml);
console.log('✓ Static sitemap generated at:', sitemapPath);
