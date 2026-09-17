import { defineConfig, loadEnv } from 'vite';

function normalizeBase(value) {
  const base = String(value ?? '').trim() || '/';
  if (!base.startsWith('/') || !base.endsWith('/') || /[?#]/.test(base)) {
    throw new Error('SHOWCASE_BASE_PATH 必须是以 / 开头和结尾的静态路径。');
  }
  return base;
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_TIANDITU_SHOWCASE_');
  const showcaseKey = process.env.VITE_TIANDITU_SHOWCASE_KEY ?? fileEnv.VITE_TIANDITU_SHOWCASE_KEY ?? '';

  return {
    base: normalizeBase(process.env.SHOWCASE_BASE_PATH),
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    // 仅注入未来单独申请的展示版浏览器 Key；默认留空并使用本地降级底图
    define: {
      'import.meta.env.VITE_TIANDITU_SHOWCASE_KEY': JSON.stringify(showcaseKey),
    },
  };
});
