import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    root: 'src',
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            buffer: 'buffer'
        }
    },
    optimizeDeps: {
        include: ['@solana/pay', '@solana/web3.js', 'buffer']
    },
    build: {
        rollupOptions: {
            external: [],
        },
    },
});