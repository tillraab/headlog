// ATC codes from the WHOCC ATC/DDD index (atcddd.fhi.no); brand ingredients checked against Fachinformation, Gelbe Liste, aponet, EMA and manufacturer pages.
import type { MedCategory } from './medication';

/** A product or active ingredient the medication list recognises by name. */
export interface Medicine {
  /** Lower case: INN in English and German, German and international brands. */
  names: string[];
  /** INN, English. */
  ingredients: string[];
  /** WHO ATC code of the product; for a combination the code of its main ingredient's combinations. */
  atc: string;
  category: MedCategory;
}

/** Headache medication: acute treatment of migraine, tension-type and cluster headache, antiemetics and prophylaxis. */
export const MEDICINES: readonly Medicine[] = [
  // Non-opioid analgesics (ICHD-3 8.2.3)
  { names: ['ibuprofen', 'ibu', 'nurofen', 'dolormin', 'aktren', 'spalt forte'], ingredients: ['ibuprofen'], atc: 'M01AE01', category: 'analgesic' },
  { names: ['dexibuprofen'], ingredients: ['dexibuprofen'], atc: 'M01AE14', category: 'analgesic' },
  { names: ['naproxen', 'aleve'], ingredients: ['naproxen'], atc: 'M01AE02', category: 'analgesic' },
  { names: ['ketoprofen'], ingredients: ['ketoprofen'], atc: 'M01AE03', category: 'analgesic' },
  { names: ['dexketoprofen', 'sympal'], ingredients: ['dexketoprofen'], atc: 'M01AE17', category: 'analgesic' },
  { names: ['diclofenac', 'voltaren'], ingredients: ['diclofenac'], atc: 'M01AB05', category: 'analgesic' },
  { names: ['indometacin', 'indomethacin'], ingredients: ['indometacin'], atc: 'M01AB01', category: 'analgesic' },
  { names: ['ketorolac'], ingredients: ['ketorolac'], atc: 'M01AB15', category: 'analgesic' },
  { names: ['mefenaminsäure', 'mefenamic acid'], ingredients: ['mefenamic acid'], atc: 'M01AG01', category: 'analgesic' },
  { names: ['tolfenaminsäure', 'tolfenamic acid'], ingredients: ['tolfenamic acid'], atc: 'M01AG02', category: 'analgesic' },
  { names: ['celecoxib'], ingredients: ['celecoxib'], atc: 'M01AH01', category: 'analgesic' },
  { names: ['etoricoxib', 'arcoxia'], ingredients: ['etoricoxib'], atc: 'M01AH05', category: 'analgesic' },
  { names: ['acetylsalicylsäure', 'acetylsalicylic acid', 'ass', 'aspirin'], ingredients: ['acetylsalicylic acid'], atc: 'N02BA01', category: 'analgesic' },
  { names: ['metamizol', 'metamizole', 'dipyrone', 'novaminsulfon', 'novalgin'], ingredients: ['metamizole'], atc: 'N02BB02', category: 'analgesic' },
  { names: ['phenazon', 'phenazone', 'migräne-kranit'], ingredients: ['phenazone'], atc: 'N02BB01', category: 'analgesic' },
  { names: ['propyphenazon', 'propyphenazone'], ingredients: ['propyphenazone'], atc: 'N02BB04', category: 'analgesic' },
  { names: ['paracetamol', 'acetaminophen', 'ben-u-ron', 'tylenol', 'panadol'], ingredients: ['paracetamol'], atc: 'N02BE01', category: 'analgesic' },
  // Acetylsalicylic acid with metoclopramide: one analgesic; the antiemetic does not count toward overuse.
  { names: ['migpriv'], ingredients: ['acetylsalicylic acid', 'metoclopramide'], atc: 'N02BA51', category: 'analgesic' },

  // Combination analgesics: two analgesics, or an analgesic with caffeine (ICHD-3 8.2.5)
  { names: ['thomapyrin', 'thomapyrin classic', 'thomapyrin intensiv'], ingredients: ['acetylsalicylic acid', 'paracetamol', 'caffeine'], atc: 'N02BE51', category: 'combination' },
  { names: ['thomapyrin tension duo'], ingredients: ['ibuprofen', 'caffeine'], atc: 'M01AE51', category: 'combination' },
  { names: ['neuralgin', 'neuralgin pac'], ingredients: ['acetylsalicylic acid', 'paracetamol', 'caffeine'], atc: 'N02BE51', category: 'combination' },
  { names: ['titralgan'], ingredients: ['acetylsalicylic acid', 'paracetamol', 'caffeine'], atc: 'N02BE51', category: 'combination' },
  { names: ['excedrin'], ingredients: ['acetylsalicylic acid', 'paracetamol', 'caffeine'], atc: 'N02BE51', category: 'combination' },
  { names: ['ratiopyrin'], ingredients: ['acetylsalicylic acid', 'paracetamol', 'caffeine'], atc: 'N02BE51', category: 'combination' },
  { names: ['spalt plus coffein', 'spalt plus'], ingredients: ['acetylsalicylic acid', 'paracetamol', 'caffeine'], atc: 'N02BE51', category: 'combination' },
  { names: ['doppel spalt'], ingredients: ['acetylsalicylic acid', 'caffeine'], atc: 'N02BA51', category: 'combination' },
  { names: ['saridon'], ingredients: ['propyphenazone', 'paracetamol', 'caffeine'], atc: 'N02BB54', category: 'combination' },

  // Triptans (ICHD-3 8.2.2)
  { names: ['sumatriptan', 'imigran', 'imitrex'], ingredients: ['sumatriptan'], atc: 'N02CC01', category: 'triptan' },
  { names: ['naratriptan', 'naramig', 'formigran'], ingredients: ['naratriptan'], atc: 'N02CC02', category: 'triptan' },
  { names: ['zolmitriptan', 'ascotop', 'zomig'], ingredients: ['zolmitriptan'], atc: 'N02CC03', category: 'triptan' },
  { names: ['rizatriptan', 'maxalt'], ingredients: ['rizatriptan'], atc: 'N02CC04', category: 'triptan' },
  { names: ['almotriptan', 'almogran', 'dolortriptan'], ingredients: ['almotriptan'], atc: 'N02CC05', category: 'triptan' },
  { names: ['eletriptan', 'relpax'], ingredients: ['eletriptan'], atc: 'N02CC06', category: 'triptan' },
  { names: ['frovatriptan', 'allegro'], ingredients: ['frovatriptan'], atc: 'N02CC07', category: 'triptan' },

  // Ergot alkaloids (ICHD-3 8.2.1)
  { names: ['ergotamin', 'ergotamine', 'ergo-kranit'], ingredients: ['ergotamine'], atc: 'N02CA02', category: 'ergotamine' },
  { names: ['dihydroergotamin', 'dihydroergotamine', 'dhe', 'migranal'], ingredients: ['dihydroergotamine'], atc: 'N02CA01', category: 'ergotamine' },

  // Opioids (ICHD-3 8.2.4); a combination with an opioid counts as opioid
  { names: ['tramadol', 'tramal'], ingredients: ['tramadol'], atc: 'N02AX02', category: 'opioid' },
  { names: ['tilidin', 'tilidine', 'valoron'], ingredients: ['tilidine', 'naloxone'], atc: 'N02AX51', category: 'opioid' },
  { names: ['tapentadol', 'palexia'], ingredients: ['tapentadol'], atc: 'N02AX06', category: 'opioid' },
  { names: ['oxycodon', 'oxycodone'], ingredients: ['oxycodone'], atc: 'N02AA05', category: 'opioid' },
  { names: ['targin'], ingredients: ['oxycodone', 'naloxone'], atc: 'N02AA55', category: 'opioid' },
  { names: ['morphin', 'morphine', 'mst'], ingredients: ['morphine'], atc: 'N02AA01', category: 'opioid' },
  { names: ['hydromorphon', 'hydromorphone'], ingredients: ['hydromorphone'], atc: 'N02AA03', category: 'opioid' },
  { names: ['buprenorphin', 'buprenorphine'], ingredients: ['buprenorphine'], atc: 'N02AE01', category: 'opioid' },
  { names: ['codein', 'codeine'], ingredients: ['codeine'], atc: 'R05DA04', category: 'opioid' },
  { names: ['talvosilen'], ingredients: ['paracetamol', 'codeine'], atc: 'N02AJ06', category: 'opioid' },
  { names: ['zaldiar'], ingredients: ['tramadol', 'paracetamol'], atc: 'N02AJ13', category: 'opioid' },

  // Against nausea
  { names: ['metoclopramid', 'metoclopramide', 'mcp', 'paspertin'], ingredients: ['metoclopramide'], atc: 'A03FA01', category: 'antiemetic' },
  { names: ['domperidon', 'domperidone', 'motilium'], ingredients: ['domperidone'], atc: 'A03FA03', category: 'antiemetic' },
  { names: ['dimenhydrinat', 'dimenhydrinate', 'vomex'], ingredients: ['dimenhydrinate'], atc: 'R06AA11', category: 'antiemetic' },
  { names: ['ondansetron', 'zofran'], ingredients: ['ondansetron'], atc: 'A04AA01', category: 'antiemetic' },
  { names: ['prochlorperazin', 'prochlorperazine'], ingredients: ['prochlorperazine'], atc: 'N05AB04', category: 'antiemetic' },

  // Prophylaxis of migraine, tension-type and cluster headache
  { names: ['propranolol', 'dociton'], ingredients: ['propranolol'], atc: 'C07AA05', category: 'preventive' },
  { names: ['metoprolol', 'beloc', 'beloc-zok'], ingredients: ['metoprolol'], atc: 'C07AB02', category: 'preventive' },
  { names: ['bisoprolol'], ingredients: ['bisoprolol'], atc: 'C07AB07', category: 'preventive' },
  { names: ['topiramat', 'topiramate', 'topamax'], ingredients: ['topiramate'], atc: 'N03AX11', category: 'preventive' },
  { names: ['valproat', 'valproate', 'valproinsäure', 'valproic acid'], ingredients: ['valproic acid'], atc: 'N03AG01', category: 'preventive' },
  { names: ['amitriptylin', 'amitriptyline', 'saroten'], ingredients: ['amitriptyline'], atc: 'N06AA09', category: 'preventive' },
  { names: ['venlafaxin', 'venlafaxine'], ingredients: ['venlafaxine'], atc: 'N06AX16', category: 'preventive' },
  { names: ['flunarizin', 'flunarizine'], ingredients: ['flunarizine'], atc: 'N07CA03', category: 'preventive' },
  { names: ['candesartan', 'atacand'], ingredients: ['candesartan'], atc: 'C09CA06', category: 'preventive' },
  { names: ['lisinopril'], ingredients: ['lisinopril'], atc: 'C09AA03', category: 'preventive' },
  { names: ['botox', 'onabotulinumtoxina', 'botulinumtoxin', 'botulinum toxin'], ingredients: ['onabotulinumtoxinA'], atc: 'M03AX01', category: 'preventive' },
  { names: ['erenumab', 'aimovig'], ingredients: ['erenumab'], atc: 'N02CD01', category: 'preventive' },
  { names: ['galcanezumab', 'emgality'], ingredients: ['galcanezumab'], atc: 'N02CD02', category: 'preventive' },
  { names: ['fremanezumab', 'ajovy'], ingredients: ['fremanezumab'], atc: 'N02CD03', category: 'preventive' },
  { names: ['eptinezumab', 'vyepti'], ingredients: ['eptinezumab'], atc: 'N02CD05', category: 'preventive' },
  { names: ['atogepant', 'aquipta', 'qulipta'], ingredients: ['atogepant'], atc: 'N02CD07', category: 'preventive' },
  { names: ['pizotifen'], ingredients: ['pizotifen'], atc: 'N02CX01', category: 'preventive' },
  { names: ['verapamil', 'isoptin'], ingredients: ['verapamil'], atc: 'C08DA01', category: 'preventive' },
  { names: ['lithium'], ingredients: ['lithium'], atc: 'N05AN01', category: 'preventive' },
  { names: ['magnesium'], ingredients: ['magnesium'], atc: 'A12CC30', category: 'preventive' },
  { names: ['riboflavin', 'vitamin b2'], ingredients: ['riboflavin'], atc: 'A11HA04', category: 'preventive' },
  { names: ['coenzym q10', 'coenzyme q10', 'q10', 'ubidecarenon', 'ubidecarenone'], ingredients: ['ubidecarenone'], atc: 'C01EB09', category: 'preventive' },
  { names: ['melatonin', 'circadin'], ingredients: ['melatonin'], atc: 'N05CH01', category: 'preventive' },

  // Acute treatment without an ICHD-3 overuse class
  { names: ['ubrogepant', 'ubrelvy'], ingredients: ['ubrogepant'], atc: 'N02CD04', category: 'other' },
  { names: ['rimegepant', 'vydura', 'nurtec'], ingredients: ['rimegepant'], atc: 'N02CD06', category: 'other' },
  { names: ['zavegepant', 'zavzpret'], ingredients: ['zavegepant'], atc: 'N02CD08', category: 'other' },
  { names: ['lasmiditan', 'reyvow'], ingredients: ['lasmiditan'], atc: 'N02CC08', category: 'other' },
  { names: ['prednisolon', 'prednisolone'], ingredients: ['prednisolone'], atc: 'H02AB06', category: 'other' },
  { names: ['prednison', 'prednisone'], ingredients: ['prednisone'], atc: 'H02AB07', category: 'other' },
  { names: ['lidocain', 'lidocaine'], ingredients: ['lidocaine'], atc: 'N01BB02', category: 'other' }
];

/** Words for caffeine in a typed name; with one pain reliever it makes a combination. */
export const CAFFEINE_NAMES = ['coffein', 'koffein', 'caffeine', 'coffeinum'];

/** Names written differently from "first letter upper case": abbreviations and brands as their makers write them. */
const DISPLAY_NAMES: Record<string, string> = {
  ass: 'ASS',
  mcp: 'MCP',
  dhe: 'DHE',
  mst: 'MST',
  ibu: 'IBU',
  'ben-u-ron': 'ben-u-ron',
  'beloc-zok': 'Beloc-Zok',
  'migräne-kranit': 'Migräne-Kranit',
  'ergo-kranit': 'Ergo-Kranit',
  'spalt forte': 'Spalt Forte',
  'spalt plus': 'Spalt Plus',
  'spalt plus coffein': 'Spalt plus Coffein',
  'doppel spalt': 'Doppel Spalt',
  'thomapyrin classic': 'Thomapyrin Classic',
  'thomapyrin intensiv': 'Thomapyrin Intensiv',
  'thomapyrin tension duo': 'Thomapyrin Tension Duo',
  'neuralgin pac': 'Neuralgin PAC',
  onabotulinumtoxina: 'OnabotulinumtoxinA',
  'coenzym q10': 'Coenzym Q10',
  'coenzyme q10': 'Coenzyme Q10',
  q10: 'Q10',
  'vitamin b2': 'Vitamin B2'
};

/** A name of the table as it is written on the pack. */
export function displayName(name: string): string {
  return DISPLAY_NAMES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

/** Ingredients whose German name is not the English INN without its final "e". */
const GERMAN_INGREDIENTS: Record<string, string> = {
  'acetylsalicylic acid': 'ASS',
  caffeine: 'Coffein',
  'mefenamic acid': 'Mefenaminsäure',
  'tolfenamic acid': 'Tolfenaminsäure',
  'valproic acid': 'Valproinsäure',
  onabotulinumtoxinA: 'Botulinumtoxin A'
};

/**
 * An ingredient in the app language: English INN in lower case ("aspirin" for acetylsalicylic acid), German INN as a
 * noun, which drops the final "e" ("metamizole" is "Metamizol").
 */
export function ingredientName(inn: string, lang: 'en' | 'de'): string {
  if (lang === 'en') return inn === 'acetylsalicylic acid' ? 'aspirin' : inn;
  const de = GERMAN_INGREDIENTS[inn] ?? inn.replace(/e$/, '');
  return de.charAt(0).toUpperCase() + de.slice(1);
}

/** Lower case with umlauts and ß spelled out plainly and everything but letters and digits dropped: "Migräne-Kranit" is "migranekranit". */
function searchKey(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');
}

/** A medicine with the name a search found it by. */
export interface MedicineMatch {
  name: string;
  medicine: Medicine;
}

/**
 * Up to `limit` medicines for a typed name, one per medicine with its best name: names that start with the text before
 * names that only contain it, within each the name closest in length to the text first. Needs two letters.
 */
export function suggestMedicines(query: string, limit = 6): MedicineMatch[] {
  const q = searchKey(query);
  if (q.length < 2) return [];
  const ranked: (MedicineMatch & { rank: number; extra: number })[] = [];
  for (const medicine of MEDICINES) {
    let best: (MedicineMatch & { rank: number; extra: number }) | undefined;
    for (const name of medicine.names) {
      const key = searchKey(name);
      const at = key.indexOf(q);
      if (at < 0) continue;
      const candidate = { name, medicine, rank: at === 0 ? 0 : 1, extra: key.length - q.length };
      if (!best || candidate.rank < best.rank || (candidate.rank === best.rank && candidate.extra < best.extra)) best = candidate;
    }
    if (best) ranked.push(best);
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.extra - b.extra || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, medicine }) => ({ name, medicine }));
}

/** The medicines whose names or ingredients contain the text, in table order; all of them for an empty text. */
export function searchMedicines(query: string): Medicine[] {
  const q = searchKey(query);
  return MEDICINES.filter((m) => [...m.names, ...m.ingredients].some((n) => searchKey(n).includes(q)));
}

/** The name an entry is listed under: the English INN in English when the entry has one, else its first name. */
export function mainName(medicine: Medicine, lang: 'en' | 'de'): string {
  const inn = medicine.ingredients.length === 1 ? medicine.ingredients[0] : '';
  return lang === 'en' && medicine.names.includes(inn) ? inn : medicine.names[0];
}

/**
 * The other names of an entry, each spelling once: a name that differs from the main name or an earlier one only by a
 * final "e", spaces or hyphens ("metamizole" for "metamizol", "botulinum toxin" for "botulinumtoxin") is left out.
 */
export function otherNames(medicine: Medicine, main: string): string[] {
  const stem = (name: string) => searchKey(name).replace(/e$/, '');
  const seen = new Set([stem(main)]);
  return medicine.names.filter((n) => !seen.has(stem(n)) && seen.add(stem(n)));
}
