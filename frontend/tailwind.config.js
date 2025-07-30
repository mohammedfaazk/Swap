module.exports = {
  content: [
    "./src//*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#7f5af0",
        "brand-faint": "#d9d6f6",
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};