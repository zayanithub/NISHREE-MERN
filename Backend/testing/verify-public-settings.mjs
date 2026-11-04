import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/DBconfig.js';
import { getPublicStoreDetails } from '../service/storeSettingsService.js';

await connectDB();
try {
  const settings = await getPublicStoreDetails();
  const result = {
    storeName: settings.storeName,
    emailConfigured: Boolean(settings.supportEmail),
    phoneConfigured: Boolean(settings.supportPhone),
    addressConfigured: Boolean(settings.businessAddress),
    whatsappConfigured: Boolean(settings.whatsappUrl),
    instagramConfigured: Boolean(settings.instagramUrl),
    facebookConfigured: Boolean(settings.facebookUrl),
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
