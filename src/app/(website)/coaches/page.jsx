import { Suspense } from "react";
import PageHeader from "../components/layout/PageHeader";
import CoachesGridSection from "../components/coaches/CoachesGridSection";
import SupportExpertsSection from "../components/coaches/SupportExpertsSection";
import CtaSection from "../components/home/CtaSection";

export const metadata = {
  title: "Expert Coaches & Mentors | CST Cricket Academy",
  description:
    "Meet our elite panel of BCCI & ICC certified coaches, former first-class cricketers, specialized batting coaches, fast bowling masters, and physiotherapists at CST Cricket Academy.",
};

export default function CoachesPage() {
  return (
    <>
      <PageHeader
        title="Learn From The Best"
        eyebrow="Our Team"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Coaches"
      />
      <Suspense fallback={<div className="text-center py-5 text-white">Loading coaches panel...</div>}>
        <CoachesGridSection />
      </Suspense>
      <SupportExpertsSection />
      <CtaSection />
    </>
  );
}
