import PageHeader from "../components/layout/PageHeader";
import ProgramsListSection from "../components/programs/ProgramsListSection";
import WeeklyScheduleSection from "../components/programs/WeeklyScheduleSection";
import AdmissionProcessSection from "../components/programs/AdmissionProcessSection";

export const metadata = {
  title: "Cricket Coaching Programs & Batches | CST Cricket Academy",
  description:
    "Explore professional cricket coaching programs: Foundation (Under-12), Intermediate (Under-16), Advanced Elite batches, private 1-on-1 coaching, and flexible weekend training schedules.",
  keywords: [
    "Cricket Coaching Programs",
    "Cricket Batches",
    "Under 14 Cricket Coaching",
    "Under 19 Cricket Training",
    "Private Cricket Coaching",
    "Weekend Cricket Academy",
    "Cricket Fee Structure",
    "Fast Bowling Masterclass",
    "Spin Bowling Coaching",
  ],
  openGraph: {
    title: "Cricket Coaching Programs & Batches | CST Cricket Academy",
    description:
      "Explore professional cricket coaching programs, batch timings, and fee structures for all age groups at CST Cricket Academy.",
  },
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
