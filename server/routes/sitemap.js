const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');

// Generate dynamic sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = 'https://www.eexams.net';
    
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

    // Fetch public exams from marketplace
    const publicExams = await Exam.find({ 
      isPublic: true,
      isLocked: false 
    }).select('_id updatedAt').lean();

    const examPages = publicExams.map(exam => ({
      url: `/marketplace/exams/${exam._id}/request`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: exam.updatedAt ? exam.updatedAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));

    // Combine all pages
    const allPages = [...staticPages, ...examPages];

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

module.exports = router;
