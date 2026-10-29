import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let phones on the local network load the dev server (and its live-reload socket) by IP.
  allowedDevOrigins: ["172.20.10.*", "192.168.*.*", "10.*.*.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
