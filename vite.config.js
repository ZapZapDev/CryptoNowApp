import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    optimizeDeps: {
        include: ['@solana/pay', '@solana/web3.js','buffer']
    },
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            buffer: 'buffer'
        }
    }
});

