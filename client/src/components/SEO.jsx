import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({
  title = 'eexams - Rwanda\'s Leading Online Exam Platform | AI-Powered Grading',
  description = 'eexams is Rwanda\'s premier online exam management system. AI-powered grading, real-time analytics, secure exams for schools and universities. Join 140+ institutions using eexams.',
  keywords = 'eexams, online exams, Rwanda, education, AI grading, exam platform, digital assessment, student testing, school management, university exams, Kinyarwanda exams, English exams, Rwanda exams, exams.net, national exams, secondary exams, primary exams',
  ogImage = 'https://www.eexams.net/og-image.png',
  ogUrl = 'https://www.eexams.net/',
  ogType = 'website',
  canonical = 'https://www.eexams.net/',
  noindex = false,
  nofollow = false,
  structuredData = null,
  breadcrumbs = null,
}) => {
  const robotsContent = [
    noindex ? 'noindex' : 'index',
    nofollow ? 'nofollow' : 'follow',
  ].join(', ');

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="eexams" />
      <meta name="robots" content={robotsContent} />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="eexams" />
      <meta property="og:locale" content="en_RW" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={ogUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />

      {/* Geo Location for Rwanda */}
      <meta name="geo.region" content="RW" />
      <meta name="geo.placename" content="Rwanda" />
      <meta name="geo.position" content="-1.9403;29.8739" />
      <meta name="ICBM" content="-1.9403, 29.8739" />

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Alternate Language */}
      <link rel="alternate" hreflang="en" href="https://www.eexams.net/" />
      <link rel="alternate" hreflang="rw" href="https://www.eexams.net/rw/" />

      {/* Structured Data */}
      {structuredData && (
        Array.isArray(structuredData) ? (
          structuredData.map((data, index) => (
            <script key={index} type="application/ld+json">
              {JSON.stringify(data)}
            </script>
          ))
        ) : (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )
      )}

      {/* Breadcrumb Structured Data */}
      {breadcrumbs && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              item: item.url,
            })),
          })}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
