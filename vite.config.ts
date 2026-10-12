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
        },
      },
    },
    plugins: [
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html
            .replaceAll('rockwallroofingandgutters@gmail.com', recipient)
            .replaceAll('https://rockwall-dallas-roofing.heartyhaven9.chatgpt.site', siteUrl);
        },
      },
    ],
    server: {
      port: 4173,
    },
    preview: {
      port: 4173,
    },
  };
});
