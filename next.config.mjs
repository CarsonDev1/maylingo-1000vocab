/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "mochien3.1-api.mochidemy.com" },
      { protocol: "https", hostname: "mochien-server.mochidemy.com" },
      { protocol: "https", hostname: "mochien-server-release.mochidemy.com" },
    ],
  },
};

export default nextConfig;
