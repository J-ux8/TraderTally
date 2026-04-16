const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'wasm' to the list of asset extensions so that WebAssembly modules are resolved
// Required for expo-sqlite to work on the Web
config.resolver.assetExts.push('wasm');

module.exports = config;
