/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PRD §5 Security: the admin panel must never be publicly discoverable and
  // should sit behind an IP allowlist / VPN. These headers are a baseline;
  // the IP allowlist itself is enforced at the edge (Cloudflare / firewall).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
