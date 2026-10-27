import PageHeader from "../components/layout/PageHeader";
import ProgramsListSection from "../components/programs/ProgramsListSection";
import WeeklyScheduleSection from "../components/programs/WeeklyScheduleSection";
import AdmissionProcessSection from "../components/programs/AdmissionProcessSection";

export const metadata = {
  title: "Programs & Fees | ST Cricket Academy",
  description:
    "Explore coaching programs, batch timings, and fee structures at ST Cricket Academy.",
};

export default function ProgramsPage() {
  return (
    <>
      <PageHeader
        title="Programs"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Programs"
      />
      <ProgramsListSection />
      <WeeklyScheduleSection />
      <AdmissionProcessSection />
    </>
  );
}
