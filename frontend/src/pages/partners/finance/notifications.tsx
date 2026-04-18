import NotificationsPage from "../../notifications";
import { getPartnerFinancierLayout } from "../../../components/Layout";

export default function PartnerFinanceNotificationsPage() {
  return <NotificationsPage />;
}

PartnerFinanceNotificationsPage.getLayout = getPartnerFinancierLayout;
