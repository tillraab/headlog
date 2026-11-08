/** Literature behind the forecast rules and medication limits, listed in the info sheets. */

const ICHD3 = 'Headache Classification Committee of the International Headache Society (2018). The International Classification of Headache Disorders, 3rd edition (ICHD-3). Cephalalgia 38:1–211.';

export const SOURCES = {
  weather: [
    'Kimoto K, Aiba S, Takashima R, et al. (2011). Influence of barometric pressure in patients with migraine headache. Intern Med 50:1923–1928. doi:10.2169/internalmedicine.50.5640',
    'Li S, Liu Q, Ma M, Fang J, He L (2025). Association between weather conditions and migraine: a systematic review and meta-analysis. J Neurol 272:346. doi:10.1007/s00415-025-13078-0',
    'Katsuki M, Moran K, Tatsumoto M, et al. (2026). Weather factors associated with recorded headache events and user-level meteorological recording profiles in smartphone headache diary data: a retrospective observational study. J Headache Pain, article in press. doi:10.1186/s10194-026-02529-2'
  ],
  hydration: [
    'Blau JN, Kell CA, Sperling JM (2004). Water-deprivation headache: a new headache with two variants. Headache 44:79–83. doi:10.1111/j.1526-4610.2004.04014.x',
    'Spigt M, Weerkamp N, Troost J, van Schayck CP, Knottnerus JA (2012). A randomized trial on the effects of regular water intake in patients with recurrent headaches. Fam Pract 29:370–375. doi:10.1093/fampra/cmr112'
  ],
  sleep: [
    'Bertisch SM, Li W, Buettner C, et al. (2020). Nightly sleep duration, fragmentation, and quality and daily risk of migraine. Neurology 94:e489–e496. doi:10.1212/WNL.0000000000008740',
    'Ohayon M, Wickwire EM, Hirshkowitz M, et al. (2017). National Sleep Foundation’s sleep quality recommendations: first report. Sleep Health 3:6–19. doi:10.1016/j.sleh.2016.11.006'
  ],
  alcohol: [
    'Onderwater GLJ, van Oosterhout WPJ, Schoonman GG, Ferrari MD, Terwindt GM (2019). Alcoholic beverages as trigger factor and the effect on alcohol consumption behavior in patients with migraine. Eur J Neurol 26:588–595. doi:10.1111/ene.13861',
    'Vives-Mestres M, Casanova A, Puig X, Ginebra J, Rosen N (2022). Alcohol as a trigger of migraine attacks in people with migraine. Results from a large prospective cohort study in English-speaking countries. Headache 62:1329–1338. doi:10.1111/head.14428'
  ],
  caffeine: [
    'Juliano LM, Griffiths RR (2004). A critical review of caffeine withdrawal: empirical validation of symptoms and signs, incidence, severity, and associated features. Psychopharmacology 176:1–29. doi:10.1007/s00213-004-2000-x',
    `${ICHD3} 8.3.1 Caffeine-withdrawal headache.`
  ],
  medication: [
    'Diener HC, Förderreuther S, Kropp P, Reuter U, et al. (2025). Therapie der Migräneattacke und Prophylaxe der Migräne, S1-Leitlinie. Deutsche Gesellschaft für Neurologie (DGN) und Deutsche Migräne- und Kopfschmerzgesellschaft (DMKG). AWMF-Register 030/057.',
    'Diener HC, Kropp P, Dresler T, et al. (2022). Management of medication overuse (MO) and medication overuse headache (MOH) S1 guideline. Neurol Res Pract 4:37. doi:10.1186/s42466-022-00200-0',
    `${ICHD3} 8.2 Medication-overuse headache.`
  ],
  chronic: [`${ICHD3} 1.3 Chronic migraine; 2.3 Chronic tension-type headache.`]
} as const;
