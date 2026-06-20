import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/sitemap.xml': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
      '^/(?!api|src/|@vite|@react-refresh|@id/|@fs/|node_modules/|manifest\\.webmanifest|favicon\\.ico|favicon\\.png|favicon-16x16\\.png|favicon-32x32\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|icon-192\\.png|icon-512\\.png|icon\\.svg|vite\\.svg)[^?]+\\.(?:avif|bmp|gif|heic|ico|jpe?g|png|svg|tiff?|webp|m4v|mkv|mov|mp4|webm|avi|mpg|mpeg|wmv|flv|f4v|3gp|3g2|ogv|mts|m2ts|ts|vob|rm|rmvb|asf|mxf|m1v|m2v|mp3|m4a|aac|wav|flac|ogg|wma|alac|aiff|pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|txt|md|json|csv|log|zip|rar|7z|tar|gz|tgz|bz2|tbz|tbz2|xz|txz|lz|lzma|z|zst|iso|cab|arj|ace|jar|war|ear|apk|ipa)(?:\\?.*)?$':
        'http://localhost:3001',
    },
  },
});
