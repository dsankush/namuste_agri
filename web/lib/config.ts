export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Kisan Sathi";
export const BUSINESS = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Kisan Sathi Agri Inputs";
export const ASSISTANT = process.env.NEXT_PUBLIC_ASSISTANT_NAME || "Priya";
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL || "mailto:hello@example.com";

export type Mode = "voice" | "chat";
export type CustomerType = "farmer" | "retailer" | "distributor";

export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "auto", label: "Auto Detect", native: "Auto Detect" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "en-IN", label: "English", native: "English" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "od-IN", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം" },
];

export const SUPPORTED = ["English", "Hindi", "Marathi", "Punjabi", "Gujarati", "Tamil", "Telugu", "Bengali", "Kannada", "Malayalam", "Odia"];

export const CUSTOMER_TYPES: { id: CustomerType; label: string; subtitle: string }[] = [
  { id: "farmer", label: "Farmer", subtitle: "Crop advice · dose · where to buy" },
  { id: "retailer", label: "Retailer", subtitle: "Stock · prices · orders" },
  { id: "distributor", label: "Distributor", subtitle: "Bulk orders · trade prices" },
];

export const SUGGESTIONS: Record<CustomerType, string[]> = {
  farmer: [
    "My cotton leaves are curling, small white flies underneath",
    "मेरी सोयाबीन के पत्ते पीले पड़ रहे हैं",
    "How much Coragen do I need for 3 acres of paddy?",
    "Which shop near me sells Nativo?",
  ],
  retailer: [
    "I need 3 cartons of Pegasus 250 gram",
    "मुझे Coragen 300 ml चाहिए, 2 कार्टन",
    "What is the price of Tilt 500 ml?",
    "Repeat my last order",
  ],
  distributor: [
    "Quote 20 cartons of Saaf 500 gram",
    "Do you have Nominee Gold in stock for Punjab?",
    "What is my order status?",
    "I want to cancel my last order",
  ],
};

// Test customers already in the database, handy for demos.
export const DEMO_NUMBERS: Record<CustomerType, string> = {
  farmer: "9000000005",
  retailer: "9000000007",
  distributor: "9000000006",
};
