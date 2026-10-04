import Imprint from '@/components/App/Imprint';
import InformationPage from '@/components/App/InformationPage';
import { useUiLanguage } from '@/i18n/ui';

export default function ImprintPage() {
  useUiLanguage();
  return <InformationPage title="Imprint" intro="Operator information and contact details for this website."><Imprint /></InformationPage>;
}
