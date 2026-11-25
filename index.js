// ⚠️ DSH 的 bundle 加载器硬编码 import `<package>/index.js`，
//    不读 package.json 的 main/exports 字段，所以包根必须留这个 shim。
//    实际代码在 src/index.js，这里只做转发。
export * from './src/index.js'
