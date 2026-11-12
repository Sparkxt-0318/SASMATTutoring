import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep visited dashboard tabs for 30 seconds so switching back is instant (#13).
  // Officer and member actions call revalidatePath, which refreshes them after a change.
  experimental: { staleTimes: { dynamic: 30 } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stop other sites from putting this one in a frame (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Claim links contain a personal token, so never send them to other sites.
          // "same-origin" (not "no-referrer"): with no-referrer, a form submitted
          // before the page's JavaScript loads carries "Origin: null", and Next.js
          // rejects that server action as a possible cross-site request.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
