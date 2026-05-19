const SharedExam = require('../models/SharedExam');
const Exam = require('../models/Exam');

// @desc    Generate dynamic sitemap.xml
// @route   GET /sitemap.xml
// @access  Public
const generateSitemap = async (req, res) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || 'https://www.eexams.net';
    const currentDate = new Date().toISOString();
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">`;

    // Static pages with high priority
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },
      { url: '/marketplace', priority: '0.9', changefreq: 'daily' },
      { url: '/public-exams', priority: '0.8', changefreq: 'daily' },
      { url: '/register', priority: '0.7', changefreq: 'monthly' },
      { url: '/student-register', priority: '0.7', changefreq: 'monthly' },
      { url: '/privacy', priority: '0.5', changefreq: 'monthly' },
      { url: '/terms', priority: '0.5', changefreq: 'monthly' },
    ];

    staticPages.forEach(page => {
      sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // Public marketplace exams (limit to 1000 for performance)
    const marketplaceExams = await Exam.find({ 
      isPublic: true,
      isActive: true 
    })
    .select('title updatedAt')
    .limit(1000)
    .lean();

    marketplaceExams.forEach(exam => {
      const slug = exam.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
      
      const lastmod = exam.updatedAt ? new Date(exam.updatedAt).toISOString() : currentDate;
      
      sitemap += `
  <url>
    <loc>${baseUrl}/marketplace/exams/${exam._id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    // Public shared exams (limit to 1000 for performance)
    const sharedExams = await SharedExam.find({ 
      isActive: true,
      'settings.publicAccess': true
    })
    .populate('exam', 'title updatedAt')
    .limit(1000)
    .lean();

    sharedExams.forEach(sharedExam => {
      const examTitle = sharedExam.exam?.title || 'exam';
      const slug = examTitle
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
      
      const lastmod = sharedExam.updatedAt ? new Date(sharedExam.updatedAt).toISOString() : currentDate;
      
      sitemap += `
  <url>
    <loc>${baseUrl}/exam/${slug}/${sharedExam.shareToken}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    sitemap += `
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return basic sitemap on error
    const baseUrl = process.env.FRONTEND_URL || 'https://www.eexams.net';
    const currentDate = new Date().toISOString();
    
    const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/marketplace</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(basicSitemap);
  }
};

module.exports = {
  generateSitemap
};
