import fs from 'fs';
import path from 'path';
import https from 'https';

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
const backendUrl = 'https://eexamsbackend.onrender.com';
const today = new Date().toISOString().split('T')[0];

// Fetch public exams from backend
function fetchPublicExams() {
  return new Promise((resolve, reject) => {
    https.get(`${backendUrl}/api/marketplace/exams`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const exams = JSON.parse(data);
          resolve(exams);
        } catch (error) {
          console.error('Error parsing exam data:', error);
          resolve([]);
        }
      });
    }).on('error', (error) => {
      console.error('Error fetching exams:', error);
      resolve([]); // Return empty array on error to not break build
    });
  });
}

async function generateSitemap() {
  console.log('Fetching public exams from backend...');
  const exams = await fetchPublicExams();
  console.log(`Found ${exams.length} public exams`);

  // Generate exam pages
  const examPages = exams.map(exam => ({
    url: `/marketplace/exams/${exam._id}/request`,
    priority: '0.7',
    changefreq: 'weekly',
    lastmod: exam.updatedAt ? exam.updatedAt.split('T')[0] : today
  }));

  // Combine all pages
  const allPages = [...staticPages, ...examPages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod || today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  // Write to public folder
  const publicDir = path.join(new URL('.', import.meta.url).pathname, '../public');
  const sitemapPath = path.join(publicDir, 'sitemap.xml');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(sitemapPath, xml);
  console.log('✓ Dynamic sitemap generated at:', sitemapPath);
  console.log(`  Total URLs: ${allPages.length}`);
  console.log(`  Static pages: ${staticPages.length}`);
  console.log(`  Exam pages: ${examPages.length}`);
}

generateSitemap().catch(console.error);
