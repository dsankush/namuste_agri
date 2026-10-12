// Natural (bulbul:v4-flash) voices offered in Settings. Generated from the agent's
// voices.py (same catalogue and filters): one language per voice, styles that suit a call.
// Regenerate if Sarvam adds voices.

export type NaturalVoice = { id: string; name: string; lang: string; gender: "female" | "male"; style: string };

export const DEFAULT_NATURAL_VOICE = "ritu_hi_customer_warm";

export const NATURAL_VOICES: NaturalVoice[] = [
  {"id": "roopa_bn_conversational", "name": "Roopa", "lang": "bn", "gender": "female", "style": "Conversational"},
  {"id": "bappa_bn_conversation", "name": "Bappa", "lang": "bn", "gender": "male", "style": "Conversational"},
  {"id": "dev_en_conversational", "name": "Dev", "lang": "en", "gender": "male", "style": "Conversational"},
  {"id": "roopa_en_conversational", "name": "Roopa", "lang": "en", "gender": "female", "style": "Conversational"},
  {"id": "deven_en_conversation", "name": "Deven", "lang": "en", "gender": "male", "style": "Conversational"},
  {"id": "simran_en_conversation", "name": "Simran", "lang": "en", "gender": "female", "style": "Conversational"},
  {"id": "zarina_en_conversation", "name": "Zarina", "lang": "en", "gender": "female", "style": "Conversational"},
  {"id": "ishita_en_customer", "name": "Ishita", "lang": "en", "gender": "female", "style": "Customer care"},
  {"id": "neha_en_customer", "name": "Neha", "lang": "en", "gender": "female", "style": "Customer care"},
  {"id": "shalini_en_customer", "name": "Shalini", "lang": "en", "gender": "female", "style": "Customer care"},
  {"id": "simran_en_customer", "name": "Simran", "lang": "en", "gender": "female", "style": "Customer care"},
  {"id": "aparna_en_companion", "name": "Aparna", "lang": "en", "gender": "female", "style": "Friendly companion"},
  {"id": "sanchita_en_companion", "name": "Sanchita", "lang": "en", "gender": "female", "style": "Friendly companion"},
  {"id": "shalini_en_companion", "name": "Shalini", "lang": "en", "gender": "female", "style": "Friendly companion"},
  {"id": "simran_en_sales", "name": "Simran", "lang": "en", "gender": "female", "style": "Sales"},
  {"id": "sanchita_en_market", "name": "Sanchita", "lang": "en", "gender": "female", "style": "Market / trade"},
  {"id": "sanchita_en_insurance", "name": "Sanchita", "lang": "en", "gender": "female", "style": "Insurance"},
  {"id": "sarang_en_narration", "name": "Sarang", "lang": "en", "gender": "male", "style": "Narrator"},
  {"id": "shubh_en_narration", "name": "Shubh", "lang": "en", "gender": "male", "style": "Narrator"},
  {"id": "simran_en_narration", "name": "Simran", "lang": "en", "gender": "female", "style": "Narrator"},
  {"id": "pooja_gu_conversational", "name": "Pooja", "lang": "gu", "gender": "female", "style": "Conversational"},
  {"id": "bhavik_gu_conversation", "name": "Bhavik", "lang": "gu", "gender": "male", "style": "Conversational"},
  {"id": "pooja_gu_customer", "name": "Pooja", "lang": "gu", "gender": "female", "style": "Customer care"},
  {"id": "aayan_hi_conversational", "name": "Aayan", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "aditya_hi_conversational", "name": "Aditya", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "amit_hi_conversational", "name": "Amit", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "ashutosh_hi_conversational", "name": "Ashutosh", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "kabir_hi_conversational", "name": "Kabir", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "kavya_hi_conversational", "name": "Kavya", "lang": "hi", "gender": "female", "style": "Conversational"},
  {"id": "manan_hi_conversational", "name": "Manan", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "mohit_hi_conversational", "name": "Mohit", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "rahul_hi_conversational", "name": "Rahul", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "roopa_hi_conversational", "name": "Roopa", "lang": "hi", "gender": "female", "style": "Conversational"},
  {"id": "shreya_hi_conversational", "name": "Shreya", "lang": "hi", "gender": "female", "style": "Conversational"},
  {"id": "sumit_hi_conversational", "name": "Sumit", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "tarun_hi_conversational", "name": "Tarun", "lang": "hi", "gender": "male", "style": "Conversational"},
  {"id": "ritu_hi_conversation", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Conversational"},
  {"id": "sarika_hi_conversation", "name": "Sarika", "lang": "hi", "gender": "female", "style": "Conversational"},
  {"id": "simran_hi_conversation", "name": "Simran", "lang": "hi", "gender": "female", "style": "Conversational"},
  {"id": "ritu_hi_customer_warm", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Customer care · warm"},
  {"id": "aarti_hi_customer", "name": "Aarti", "lang": "hi", "gender": "female", "style": "Customer care"},
  {"id": "aparna_hi_customer", "name": "Aparna", "lang": "hi", "gender": "female", "style": "Customer care"},
  {"id": "chaitra_hi_customer", "name": "Chaitra", "lang": "hi", "gender": "female", "style": "Customer care"},
  {"id": "ritu_hi_customer", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Customer care"},
  {"id": "shubh_hi_customer", "name": "Shubh", "lang": "hi", "gender": "male", "style": "Customer care"},
  {"id": "ratan_hi_customer_expressive", "name": "Ratan", "lang": "hi", "gender": "male", "style": "Customer care · expressive"},
  {"id": "roopa_hi_companion", "name": "Roopa", "lang": "hi", "gender": "female", "style": "Friendly companion"},
  {"id": "shalini_hi_companion", "name": "Shalini", "lang": "hi", "gender": "female", "style": "Friendly companion"},
  {"id": "sanchita_hi_assistant", "name": "Sanchita", "lang": "hi", "gender": "female", "style": "Assistant"},
  {"id": "simran_hi_assistant", "name": "Simran", "lang": "hi", "gender": "female", "style": "Assistant"},
  {"id": "ritu_hi_customer_utility", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Customer care · crisp"},
  {"id": "aditya_hi_sales", "name": "Aditya", "lang": "hi", "gender": "male", "style": "Sales"},
  {"id": "ritu_hi_sales", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Sales"},
  {"id": "simran_hi_sales", "name": "Simran", "lang": "hi", "gender": "female", "style": "Sales"},
  {"id": "tarun_hi_sales", "name": "Tarun", "lang": "hi", "gender": "male", "style": "Sales"},
  {"id": "roopa_hi_market", "name": "Roopa", "lang": "hi", "gender": "female", "style": "Market / trade"},
  {"id": "sanchita_hi_market", "name": "Sanchita", "lang": "hi", "gender": "female", "style": "Market / trade"},
  {"id": "ishita_hi_banking", "name": "Ishita", "lang": "hi", "gender": "female", "style": "Banking"},
  {"id": "ritu_hi_banking", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Banking"},
  {"id": "sanchita_hi_banking", "name": "Sanchita", "lang": "hi", "gender": "female", "style": "Banking"},
  {"id": "ritu_hi_insurance", "name": "Ritu", "lang": "hi", "gender": "female", "style": "Insurance"},
  {"id": "roopa_hi_narration", "name": "Roopa", "lang": "hi", "gender": "female", "style": "Narrator"},
  {"id": "shilpa_hi_narration", "name": "Shilpa", "lang": "hi", "gender": "female", "style": "Narrator"},
  {"id": "simran_hi_narration", "name": "Simran", "lang": "hi", "gender": "female", "style": "Narrator"},
  {"id": "tanya_hi_narration", "name": "Tanya", "lang": "hi", "gender": "female", "style": "Narrator"},
  {"id": "chaitra_kn_conversation", "name": "Chaitra", "lang": "kn", "gender": "female", "style": "Conversational"},
  {"id": "chetan_kn_conversation", "name": "Chetan", "lang": "kn", "gender": "male", "style": "Conversational"},
  {"id": "chaitra_kn_narration", "name": "Chaitra", "lang": "kn", "gender": "female", "style": "Narrator"},
  {"id": "suchitra_kn_narration", "name": "Suchitra", "lang": "kn", "gender": "female", "style": "Narrator"},
  {"id": "ishita_mr_conversational", "name": "Ishita", "lang": "mr", "gender": "female", "style": "Conversational"},
  {"id": "nilesh_mr_conversation", "name": "Nilesh", "lang": "mr", "gender": "male", "style": "Conversational"},
  {"id": "ritu_mr_insurance", "name": "Ritu", "lang": "mr", "gender": "female", "style": "Insurance"},
  {"id": "mrunal_mr_narration", "name": "Mrunal", "lang": "mr", "gender": "female", "style": "Narrator"},
  {"id": "neha_mr_narration", "name": "Neha", "lang": "mr", "gender": "female", "style": "Narrator"},
  {"id": "ritu_mr_narration", "name": "Ritu", "lang": "mr", "gender": "female", "style": "Narrator"},
  {"id": "soham_mr_narration", "name": "Soham", "lang": "mr", "gender": "male", "style": "Narrator"},
  {"id": "anand_pa_conversation", "name": "Anand", "lang": "pa", "gender": "male", "style": "Conversational"},
  {"id": "anand_pa_customer", "name": "Anand", "lang": "pa", "gender": "male", "style": "Customer care"},
  {"id": "jaspal_pa_banking", "name": "Jaspal", "lang": "pa", "gender": "male", "style": "Banking"},
  {"id": "gokul_ta_narration", "name": "Gokul", "lang": "ta", "gender": "male", "style": "Narrator"},
  {"id": "vijay_ta_narration", "name": "Vijay", "lang": "ta", "gender": "male", "style": "Narrator"},
  {"id": "kavitha_te_conversation", "name": "Kavitha", "lang": "te", "gender": "female", "style": "Conversational"},
  {"id": "pooja_te_conversation", "name": "Pooja", "lang": "te", "gender": "female", "style": "Conversational"},
  {"id": "kavitha_te_narration", "name": "Kavitha", "lang": "te", "gender": "female", "style": "Narrator"},
  {"id": "tarun_te_narration", "name": "Tarun", "lang": "te", "gender": "male", "style": "Narrator"},
];

/** Same rule as the agent's voices.pick(): the voice a call would use for a language. */
export function pickNaturalVoice(language: string, chosen: string, male: boolean): NaturalVoice | null {
  const tag = language.split("-")[0].toLowerCase();
  const inLang = NATURAL_VOICES.filter((v) => v.lang === tag);
  const exact = inLang.find((v) => v.id === chosen);
  if (exact) return exact;
  const name = chosen.split("_")[0];
  const sameGender = inLang.filter((v) => v.gender === (male ? "male" : "female"));
  return sameGender.find((v) => v.id.split("_")[0] === name) ?? sameGender[0] ?? null;
}

export const voiceGender = (id: string) => NATURAL_VOICES.find((v) => v.id === id)?.gender;
