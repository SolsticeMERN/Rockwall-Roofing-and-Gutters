import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const recipient = env.FORM_RECIPIENT_EMAIL || 'rockwallroofingandgutters@gmail.com';
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const siteUrl = env.SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:4173');

  return {
    root: 'src',
    publicDir: false,
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'src/index.html'),
          privacy: resolve(import.meta.dirname, 'src/privacy.html'),
          thanks: resolve(import.meta.dirname, 'src/thanks.html'),
          owner: resolve(import.meta.dirname, 'src/owner.html'),
        },
      },
    },
    plugins: [
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          if (env.LEAD_CAPTURE_ENABLED === 'true') {
            html = html.replace(/action="https:\/\/formsubmit\.co\/[^\"]+"/g, 'action="/api/leads"');
            if (html.includes('data-inspection-form')) html = html.replace('</body>', '<noscript><style>form[data-inspection-form]{display:none}</style><p>Please enable JavaScript to request an inspection online, or call <a href="tel:+19728327618">972-832-7618</a>.</p></noscript></body>');
            html = html.replace(/<p>Form submissions are processed by FormSubmit.*?<\/p>/, '<p>Inspection requests are securely stored in our lead-management database through Supabase. The owner reviews requests, records follow-up notes, and arranges inspections. Resend processes owner email notifications. Advertising attribution parameters, when present, help identify the source of your inquiry. A hashed network identifier is temporarily stored for submission rate limiting. We do not automatically send customer texts through this form.</p>');
          }
          return html
            .replace('</head>', `<meta name="lead-capture-enabled" content="${env.LEAD_CAPTURE_ENABLED === 'true'}"></head>`)
            .replaceAll('rockwallroofingandgutters@gmail.com', recipient)
            .replaceAll('https://rockwall-dallas-roofing.heartyhaven9.chatgpt.site', siteUrl);
        },
      },
    ],
    server: {
      port: 4173,
      proxy: { '/api': 'http://127.0.0.1:4174' },
    },
    preview: {
      port: 4173,
    },
  };
});
