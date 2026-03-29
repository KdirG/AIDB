/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Statik Export Modu: Tauri için zorunlu.
  output: 'export', 
  
  // 2. Asset Prefix: Masaüstünde dosyaların göreceli (relative) yollarla 
  // yüklenmesini sağlar. './' kullanımı her zaman en güvenlisidir.
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',
  
  // 3. Trailing Slash: Klasör yapısını korur, index.html yönlendirmelerini kolaylaştırır.
  trailingSlash: true,
  
  // 4. Görsel Optimizasyonu: Statik exportta 'unoptimized' true olmalı.
  images: {
    unoptimized: true,
  },

  // 5. Hata Toleransı: Plotly veya karmaşık kütüphanelerdeki tip hatalarını görmezden gelir.
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 6. ESLint: Build sırasında lint hatalarının süreci durdurmasını engeller.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 7. SWC Minification: Daha hızlı build ve daha küçük dosya boyutu için.
  swcMinify: true,
};

export default nextConfig;