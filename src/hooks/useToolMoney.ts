import { useUiLanguage } from '@/i18n/ui';
import type { Currency } from '@/data/lifeTools';
export default function useMoney() { const { language } = useUiLanguage(); return (amount: number, currency: Currency) => new Intl.NumberFormat(language === 'bar' ? 'de' : language, { style: 'currency', currency }).format(amount / 100); }
