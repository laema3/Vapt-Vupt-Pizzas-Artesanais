
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bellaborda.app',
  appName: 'Bella Borda Pizzaria',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://www.bellaborda.com.br',
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
