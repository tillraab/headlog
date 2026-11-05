import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.tillraab.headlog',
  appName: 'HeadLog',
  webDir: 'build',
  backgroundColor: '#f7f6fb',
  plugins: {
    SystemBars: {
      insetsHandling: 'css'
    }
  }
};

export default config;
