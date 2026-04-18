import SettingsPage from "../../settings";
import { getPartnerFinancierLayout } from "../../../components/Layout";

export default function PartnerFinanceSettingsPage() {
  return <SettingsPage />;
}

PartnerFinanceSettingsPage.getLayout = getPartnerFinancierLayout;
