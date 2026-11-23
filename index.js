// DSH's bundle loader imports `<package>/index.js` directly, ignoring `main`
// and `exports`. Keep this compatibility shim at the package root.
export * from './src/index.js'
