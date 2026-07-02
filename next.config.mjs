/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
    // argon2 selects its .node binary at runtime via node-gyp-build; NFT does not
    // trace that path. Include the Vercel Lambda (linux x64 glibc) prebuild on every
    // server route so portal login and other password-hash entry points work.
    outputFileTracingIncludes: {
      "/*": ["./node_modules/argon2/prebuilds/linux-x64/argon2.glibc.node"],
    },
  },
};

export default nextConfig;
