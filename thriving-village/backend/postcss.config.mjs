// Strapi's admin panel build uses Vite internally, which walks up parent directories
// looking for a postcss.config.* file. Since this backend lives nested inside the
// frontend Next.js app's folder, that walk was escaping into ../postcss.config.mjs —
// the frontend's Tailwind config — and crashing because @tailwindcss/postcss is a
// frontend-only dependency never installed here. An empty config here stops the
// upward search at this directory instead.
const config = {
  plugins: {},
};

export default config;
