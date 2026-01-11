import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    define: {
      // Map process.env to VITE_ env variables for compatibility with GenAI SDK guidelines.
      // Default to empty string to prevent "undefined" injection if keys are missing.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'process.env.SUPABASE_SERVICE_KEY': JSON.stringify(env.VITE_SUPABASE_SERVICE_KEY || ''),
      // Fallback for other standard envs
      'process.env.NODE_ENV': JSON.stringify(mode),
    }
  };
});