import PageHeader from "../components/layout/PageHeader";
import CoachesGridSection from "../components/coaches/CoachesGridSection";
import SupportExpertsSection from "../components/coaches/SupportExpertsSection";

export const metadata = {
  title: "Our Coaches | ST Cricket Academy",
  description:
    "Meet our team of experienced and certified coaches and support professionals at ST Cricket Academy.",
};

export default function CoachesPage() {
  return (
    <>
      <PageHeader
        title="Coaches"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Coaches"
      />
      <CoachesGridSection />
      <SupportExpertsSection />
    </>
  );
}
