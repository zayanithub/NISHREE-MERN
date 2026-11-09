import "dotenv/config";
import dns from "node:dns";
import { resolveMx, resolveTxt } from "node:dns/promises";

const dnsServers = process.env.MONGO_DNS_SERVERS
  ?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers?.length) dns.setServers(dnsServers);

const sender = process.env.EMAIL_FROM?.trim() || "";
const senderDomain = sender.split("@")[1]?.toLowerCase();
const resolveSafely = async (resolver, hostname) => {
  try {
    return { records: await resolver(hostname), error: null };
  } catch (error) {
    return { records: [], error: error.code || "DNS_LOOKUP_FAILED" };
  }
};

if (!senderDomain) {
  console.log(JSON.stringify({
    checked: false,
    reason: "EMAIL_FROM is missing or is not a valid sender address.",
  }));
  process.exitCode = 1;
} else {
  const [dkimResult, spfResult, mxResult] = await Promise.all([
    resolveSafely(resolveTxt, `resend._domainkey.${senderDomain}`),
    resolveSafely(resolveTxt, `send.${senderDomain}`),
    resolveSafely(resolveMx, `send.${senderDomain}`),
  ]);
  const dkimRecords = dkimResult.records;
  const spfRecords = spfResult.records;
  const mxRecords = mxResult.records;
  const dkimConfigured = dkimRecords.some((record) =>
    record.join("").toLowerCase().includes("p=")
  );
  const spfConfigured = spfRecords.some((record) =>
    record.join("").toLowerCase().includes("include:amazonses.com")
  );
  const mxConfigured = mxRecords.some((record) =>
    record.exchange.toLowerCase().replace(/\.$/, "").endsWith("amazonses.com")
  );
  const result = {
    checked: true,
    senderDomain,
    dnsLookupErrors: [...new Set([dkimResult.error, spfResult.error, mxResult.error].filter(Boolean))],
    resendDkimRecordPresent: dkimConfigured,
    resendSpfRecordPresent: spfConfigured,
    resendReturnPathMxPresent: mxConfigured,
    senderDnsReady: dkimConfigured && spfConfigured && mxConfigured,
  };
  if (result.dnsLookupErrors.length) {
    result.checked = false;
    result.senderDnsReady = null;
    console.log(JSON.stringify(result));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result));
    if (!result.senderDnsReady) process.exitCode = 1;
  }
}
