/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Required for onnxruntime-node to work in API routes
  serverExternalPackages: ['onnxruntime-node'],
};

export default nextConfig;
