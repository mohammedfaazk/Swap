/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    esmExternals: 'loose'
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        buffer: require.resolve('buffer'),
        events: require.resolve('events'),
        util: require.resolve('util'),
      };
      
      // Ignore node-specific modules in Stellar SDK
      config.externals = config.externals || [];
      config.externals.push({
        'sodium-native': 'sodium-native',
        'node-forge': 'node-forge',
      });
    }
    
    // Add this to handle module resolution issues
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    };
    
    return config;
  },
}

module.exports = nextConfig
