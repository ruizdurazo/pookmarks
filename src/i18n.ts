import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import en from "./locales/en/translation.json"
import es from "./locales/es/translation.json"
import fr from "./locales/fr/translation.json"
import de from "./locales/de/translation.json"
import it from "./locales/it/translation.json"
import pt from "./locales/pt/translation.json"
import nl from "./locales/nl/translation.json"
import sv from "./locales/sv/translation.json"
import no from "./locales/no/translation.json"
import da from "./locales/da/translation.json"
import fi from "./locales/fi/translation.json"
import el from "./locales/el/translation.json"
import pl from "./locales/pl/translation.json"
import cs from "./locales/cs/translation.json"
import sk from "./locales/sk/translation.json"
import hu from "./locales/hu/translation.json"
import hr from "./locales/hr/translation.json"
import sl from "./locales/sl/translation.json"
import et from "./locales/et/translation.json"
import lv from "./locales/lv/translation.json"
import lt from "./locales/lt/translation.json"
import zh from "./locales/zh/translation.json"
import ja from "./locales/ja/translation.json"
import ko from "./locales/ko/translation.json"
import ru from "./locales/ru/translation.json"
import tr from "./locales/tr/translation.json"

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  pt: { translation: pt },
  nl: { translation: nl },
  sv: { translation: sv },
  no: { translation: no },
  da: { translation: da },
  fi: { translation: fi },
  el: { translation: el },
  pl: { translation: pl },
  cs: { translation: cs },
  sk: { translation: sk },
  hu: { translation: hu },
  hr: { translation: hr },
  sl: { translation: sl },
  et: { translation: et },
  lv: { translation: lv },
  lt: { translation: lt },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  ru: { translation: ru },
  tr: { translation: tr },
}

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: { order: ["navigator"] },
  })

export default i18n
