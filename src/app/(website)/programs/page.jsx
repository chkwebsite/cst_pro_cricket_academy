import PageHeader from "../components/layout/PageHeader";
import ProgramsListSection from "../components/programs/ProgramsListSection";
import CtaSection from "../components/home/CtaSection";

export const metadata = {
  title: "Coaching Programs | CST Cricket Academy",
  description:
    "Junior, beginner, residential and camp cricket coaching programs with fees at CST Cricket Academy in Gurugram.",
};

export default function ProgramsPage() {
  return (
    <>
      <PageHeader
        title="Find Your Perfect Program"
        eyebrow="Coaching Programs"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Coaching Programs"
      />
      <ProgramsListSection />
      <CtaSection />
    </>
  );
}
