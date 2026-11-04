import { listProducts } from "./productService.js";
import { COD_ORDER_LIMIT, RETURN_EXCHANGE_WINDOW_DAYS } from "./businessPolicy.js";
import { defaultStoreDetails, getPublicStoreDetails } from "./storeSettingsService.js";

const STOP_WORDS = new Set([
  "about", "available", "can", "could", "details", "do", "find", "for", "from", "get", "have", "help", "i", "in", "is", "it", "looking", "me", "my", "of", "on", "please", "show", "some", "tell", "the", "this", "to", "want", "what", "which", "with", "you", "your", "saree", "sarees",
]);

const searchCatalog = async () => {
  try {
    const result = await listProducts({ page: 1, limit: 100, sort: "featured" });
    return result.products || [];
  } catch {
    return [];
  }
};

const formatProduct = (product) => ({
  name: product.name,
  slug: product.slug,
  category: product.category?.name || "Saree",
  material: product.material || "",
  color: product.color || "",
  price: product.salePrice ?? product.basePrice,
  availableQuantity: Number(product.availableQuantity || 0),
  shortDescription: product.shortDescription || product.description?.slice(0, 220) || "",
  sareeLength: product.sareeLength || "",
  blouseIncluded: Boolean(product.blouseIncluded),
  blouseType: product.blouseType || "none",
  fabricCare: product.fabricCare || "",
  occasion: Array.isArray(product.occasion) ? product.occasion : [],
});

const findMatches = (question, products) => {
  const words = question.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) || [];
  if (!words.length) return [];
  return products.map((product) => {
    const content = `${product.name} ${product.category?.name || ""} ${product.material || ""} ${product.color || ""} ${product.tags?.join(" ") || ""} ${product.occasion?.join(" ") || ""}`.toLowerCase();
    return { product, score: words.reduce((score, word) => score + (content.includes(word) ? 1 : 0), 0) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map((item) => item.product);
};

const formatRupees = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

const extractMaximumPrice = (message) => {
  const match = message.match(/(?:under|below|less than|up to|upto|within|kulla|budget(?: of)?|not more than)\s*(?:₹|rs\.?\s*)?([\d,]+(?:\.\d+)?)\s*(k|thousand)?\b/i)
    || message.match(/(?:₹|rs\.?\s*)([\d,]+(?:\.\d+)?)\s*(k|thousand)?\s*(?:or less|max(?:imum)?)?/i)
    || message.match(/([\d,]+(?:\.\d+)?)\s*(k|thousand)\s*(?:kulla|within)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  const value = match[2] ? amount * 1000 : amount;
  return Number.isFinite(value) && value > 0 ? value : null;
};

const productAvailability = (product) => Number(product.availableQuantity || 0) > 0 ? "in stock" : "currently out of stock";
const productPrice = (product) => formatRupees(product.salePrice ?? product.basePrice);

const detailsFor = (product) => `${product.name} — ${productPrice(product)}, ${product.material || product.category?.name || "saree"}, ${product.color || "colour as shown"}; ${productAvailability(product)}.`;

export const answerStoreQuestionFallback = (question, products = [], settings = {}) => {
  const message = String(question || "").toLowerCase().trim();
  const store = { ...defaultStoreDetails, ...settings };
  const contact = `You can reach Nishree Attire at ${store.supportPhone}, ${store.supportEmail}, or visit ${store.businessAddress}`;
  const support = (reply) => ({ reply: `${reply} ${contact}`, products: [], contact: true });

  if (!message) return { reply: "Please type a question and I’ll help with products, ordering, or store policies.", products: [] };
  if (/^(hi|hello|hey|namaste|vanakkam|good morning|good afternoon|good evening)\b/.test(message)) {
    return { reply: "Vanakkam! I can help you find sarees by fabric, colour or budget, check catalogue details, explain payment and return policies, or guide you through an order. What are you looking for?", products: [] };
  }
  if (/\b(help|what can you do|how can you help)\b/.test(message)) {
    return { reply: "I can help browse the live catalogue, compare listed prices and fabrics, explain COD and store policies, and show where to follow an order. Ask me naturally, for example: “Show silk sarees under ₹5,000” or “How do returns work?”", products: [] };
  }
  if (/\b(track|tracking|where.*order|order status|my order|delivery status|enga.*order|order.*enga)\b/.test(message)) {
    return support("For privacy, I can’t look up an individual order in this public chat. Sign in and open My account → Orders to see the latest status recorded by the store.");
  }
  if (/\b(place an order|how to order|how do i buy|checkout|add to cart|add to bag|buy this|purchase|epdi.*order|order.*epdi|epdi.*buy)\b/.test(message)) {
    return { reply: "Open a saree’s product page, choose Add to bag, review quantities in your bag, then continue to checkout. Enter your delivery details, choose one of the payment methods shown there, review the policies and place the order. Your account’s Orders page shows the status after sign-in.", products: [] };
  }
  if (/cash on delivery|\bcod\b|pay on delivery/.test(message)) {
    return { reply: `Cash on Delivery is available only when the final order total is ${formatRupees(COD_ORDER_LIMIT)} or less. It is unavailable above that limit. Checkout will validate the final amount.`, products: [] };
  }
  if (/\b(return|exchange|replace|replacement)\b/.test(message) && /\b(damaged|defect|transit|arrived broken|broken)\b/.test(message)) {
    return support(`The policy permits return or exchange requests within ${RETURN_EXCHANGE_WINDOW_DAYS} days for review and approval, and asks customers with damaged or defective items to send photos on WhatsApp. A separate supplied condition says transit damage will not be processed, which conflicts with the general damaged-item terms and needs the business owner’s clarification. Please contact the store before relying on either condition.`);
  }
  if (/\b(return|exchange|replace|replacement)\b/.test(message)) {
    return support(`Return or exchange requests must be made within ${RETURN_EXCHANGE_WINDOW_DAYS} days of purchase and are processed only after review and approval. For a damaged or defective item, send photos through WhatsApp. The supplied transit-damage condition is still awaiting clarification by the business owner.`);
  }
  if (/\b(refund|cancel|cancellation|cancelled|canceled)\b/.test(message)) {
    return support("An eligible online order cancelled before shipping receives a full refund. If shipping has already been initiated, applicable transportation charges are deducted from the refund. Return and cancellation requests are subject to store review.");
  }
  if (/\b(damaged|defective|defect|transit damage|arrived broken|broken)\b/.test(message)) {
    return support("For a damaged or defective item, the supplied policy asks you to share photos through WhatsApp for review. The policy also states that transit damage will not be processed, which conflicts with its general damaged-item return and exchange terms. The business owner needs to clarify this condition before a definite answer can be given.");
  }
  if (/\b(payment|pay online|online payment|card|upi|razorpay)\b/.test(message)) {
    return { reply: `Checkout displays the payment methods currently enabled for the store. Cash on Delivery is available only for a final total of ${formatRupees(COD_ORDER_LIMIT)} or less; above that, choose an online method shown at checkout.`, products: [] };
  }
  if (/\b(delivery time|when.*arriv|how long.*deliver|delivery charge|shipping charge|shipping cost|deliver to|shipping|delivery|dispatch|eppo.*varum|eppo.*deliver|delivery.*eppo|evlo.*naal)\b/.test(message)) {
    return support("A confirmed delivery date or shipping charge is not available in the public catalogue. The checkout will show the applicable order total, and the store can confirm delivery coverage or timing for your address.");
  }
  if (/\b(login|log in|register|sign up|create account|profile|account|password)\b/.test(message)) {
    return { reply: "Use the account icon to sign in or create an account. After signing in, you can update your profile and addresses, review order history, and manage returns from My account. If sign-in fails, use the password reset option on the login page.", products: [] };
  }
  if (/\b(contact|phone|email|address|support|whatsapp|instagram|facebook|location|located|enga.*store|store.*enga)\b/.test(message)) {
    return { reply: `${contact}. You can also contact the team through the official WhatsApp link.`, products: [], contact: true };
  }

  const maxPrice = extractMaximumPrice(message);
  const matchingProducts = findMatches(question, products);
  let selectedProducts = matchingProducts;
  if (maxPrice !== null) {
    const candidates = matchingProducts.length ? matchingProducts : products;
    selectedProducts = candidates.filter((product) => Number(product.salePrice ?? product.basePrice) <= maxPrice).slice(0, 4);
    if (!selectedProducts.length) {
      return { reply: `I couldn’t find a listed saree at or below ${formatRupees(maxPrice)} in the current catalogue. Try another budget or browse all available styles.`, products: [] };
    }
    return { reply: `These catalogue sarees are listed at or below ${formatRupees(maxPrice)}: ${selectedProducts.map(detailsFor).join(" ")} Prices and stock come from the current catalogue.`, products: selectedProducts.map(formatProduct) };
  }

  if (matchingProducts.length) {
    const asksAvailability = /\b(in stock|stock|available|availability)\b/.test(message);
    if (asksAvailability) {
      const inStock = matchingProducts.filter((product) => Number(product.availableQuantity || 0) > 0);
      return inStock.length
        ? { reply: `These matching catalogue pieces currently show stock: ${inStock.map(detailsFor).join(" ")}`, products: inStock.map(formatProduct) }
        : support(`The matching listing${matchingProducts.length > 1 ? "s" : ""} currently show${matchingProducts.length > 1 ? "" : "s"} no verified stock. Inventory must be updated before an out-of-stock saree can be ordered. ${matchingProducts.map((product) => product.name).join(", ")}.`);
    }
    const asksBlouse = /\b(blouse|blouse piece)\b/.test(message);
    const asksLength = /\b(length|meters?|metres?)\b/.test(message);
    const asksCare = /\b(care|wash|washing|clean)\b/.test(message);
    const asksOccasion = /\b(occasion|wear to|wedding|festive)\b/.test(message);
    let answer = matchingProducts.map(detailsFor).join(" ");
    if (asksBlouse) answer += ` Blouse-piece information: ${matchingProducts.map((product) => `${product.name}: ${product.blouseIncluded ? `included${product.blouseType && product.blouseType !== "none" ? ` (${product.blouseType})` : ""}` : "not listed as included"}`).join("; ")}.`;
    if (asksLength) answer += ` Saree length: ${matchingProducts.map((product) => `${product.name}: ${product.sareeLength || "not specified in its listing"}`).join("; ")}.`;
    if (asksCare) answer += ` Care instructions: ${matchingProducts.map((product) => `${product.name}: ${product.fabricCare || "not specified in its listing"}`).join("; ")}.`;
    if (asksOccasion) answer += ` Occasion notes: ${matchingProducts.map((product) => `${product.name}: ${product.occasion?.length ? product.occasion.join(", ") : "not specified in its listing"}`).join("; ")}.`;
    return { reply: answer, products: selectedProducts.map(formatProduct) };
  }

  if (/\b(in stock|stock|available|availability)\b/.test(message)) {
    const available = products.filter((product) => Number(product.availableQuantity || 0) > 0).slice(0, 4);
    return available.length
      ? { reply: `These products currently show stock in the catalogue: ${available.map(detailsFor).join(" ")}`, products: available.map(formatProduct) }
      : support("The current catalogue shows no verified available stock. Product listings with zero stock cannot be ordered until the store updates inventory.");
  }
  if (/\b(saree|sarees|prices?|fabrics?|colou?rs?|collection|products?|catalogue|catalog|silk|cotton|banarasi|kanchipuram|georgette|organza|chiffon)\b/.test(message)) {
    const candidates = products.slice(0, 4);
    return {
      reply: products.length ? `Here are a few pieces from the current catalogue. Listed price and stock are shown below; sample listings with zero stock are not available to order until inventory is confirmed.` : `I can’t reach the live catalogue right now. ${contact}`,
      products: candidates.map(formatProduct),
      ...(!products.length ? { contact: true } : {}),
    };
  }

  return support("I don’t have a verified answer to that yet. I can help with saree styles, listed prices, stock, ordering, COD, delivery questions, accounts, order tracking, returns and refunds. Tell me a little more, or contact the team for a confirmed answer.");
};

const aiAnswer = async (question, products, settings) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const catalogue = products.map(formatProduct);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 350,
        messages: [
          { role: "system", content: `You are the Nishree Attire shopping assistant. Answer briefly and only from this current catalogue and these business rules. Never invent stock, delivery estimates, payment status, policy exceptions, credentials, or customer data. Stock is available only when availableQuantity is above zero. COD is allowed only up to INR ${COD_ORDER_LIMIT}. Returns and exchanges may be requested within ${RETURN_EXCHANGE_WINDOW_DAYS} days from purchase and require review and approval. Applicable transportation charges are deducted when shipping has been initiated. The transit-damage condition conflicts with general damaged-item provisions and is unresolved; direct the user to WhatsApp and do not decide the conflict. Public chat cannot access personal order status; direct users to sign in and view orders. For unverified questions, say you do not know and direct the customer to WhatsApp. Store contact: ${settings.supportPhone}, ${settings.supportEmail}, ${settings.businessAddress}. WhatsApp URL: ${settings.whatsappUrl}.` },
          { role: "user", content: `Current catalogue JSON: ${JSON.stringify(catalogue)}\nCustomer question: ${question}` },
        ],
      }),
    });
    if (!response.ok) {
      console.warn(`OpenAI chatbot request returned HTTP ${response.status}; using the FAQ fallback.`);
      return null;
    }
    const payload = await response.json();
    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) return null;
    const priceLimit = extractMaximumPrice(question);
    const matchedProducts = findMatches(question, products);
    const candidates = matchedProducts.length ? matchedProducts : products;
    const linkedProducts = priceLimit === null
      ? matchedProducts
      : candidates.filter((product) => Number(product.salePrice ?? product.basePrice) <= priceLimit).slice(0, 4);
    return {
      reply: reply.slice(0, 1800),
      products: linkedProducts.map(formatProduct),
      ...( /whatsapp|contact (?:the )?(?:store|team|support)|reach (?:out to )?nishree/i.test(reply) ? { contact: true } : {}),
    };
  } catch (error) {
    console.warn(`OpenAI chatbot request ${error.name === "AbortError" ? "timed out" : "could not complete"}; using the FAQ fallback.`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const answerStoreQuestion = async (question) => {
  const [products, loadedSettings] = await Promise.all([
    searchCatalog(),
    getPublicStoreDetails().catch(() => ({ ...defaultStoreDetails })),
  ]);
  const settings = { ...defaultStoreDetails, ...loadedSettings };
  const ai = await aiAnswer(question, products, settings);
  if (ai) return { ...ai, mode: "ai" };
  return { ...answerStoreQuestionFallback(question, products, settings), mode: "faq" };
};
