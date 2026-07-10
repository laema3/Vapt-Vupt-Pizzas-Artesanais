
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bertim.app',
  appName: 'BERTIM - Pastel e Hotdog',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://bertimpastelhotdog.com.br',
    cleartext: true
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
