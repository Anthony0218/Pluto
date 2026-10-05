import { useUiLanguage } from "@/i18n/ui";
export default function useToolNumber() {
  const { language } = useUiLanguage();
  const locale = language === 'bar' ? 'de-DE' : language;
  return (value: number, precision = 6) => new Intl.NumberFormat(locale, { maximumFractionDigits: precision }).format(Object.is(value, -0) ? 0 : value);
}
