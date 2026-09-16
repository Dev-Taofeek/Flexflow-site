import en from "./en";
import fr from "./fr";
import es from "./es";
import pt from "./pt";
import de from "./de";
import ar from "./ar";
import zh from "./zh";
import ja from "./ja";

export const dictionaries = {
  en,
  fr,
  es,
  pt,
  de,
  ar,
  zh,
  ja,
};

export const supportedLocales = Object.keys(dictionaries);

export default dictionaries;