const appJson = require("./app.json");

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

if (!googleMapsApiKey) {
  console.warn(
    "Missing Google Maps API key. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY before running Expo.",
  );
}

const baseAndroid = appJson.expo.android || {};
const baseAndroidConfig = baseAndroid.config || {};

module.exports = {
  ...appJson.expo,
  android: {
    ...baseAndroid,
    config: {
      ...baseAndroidConfig,
      ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
    },
  },
};
