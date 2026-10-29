import PageHeader from "../components/layout/PageHeader";
import CoachesGridSection from "../components/coaches/CoachesGridSection";
import SupportExpertsSection from "../components/coaches/SupportExpertsSection";

export const metadata = {
  title: "Expert Coaches & Mentors | CST Cricket Academy",
  description:
    "Meet our elite panel of BCCI & ICC certified coaches, former first-class cricketers, specialized batting coaches, fast bowling masters, and physiotherapists at CST Cricket Academy.",
  keywords: [
    "Cricket Coaches",
    "BCCI Certified Cricket Coach",
    "ICC Accredited Cricket Trainer",
    "Batting Coach",
    "Fast Bowling Masterclass",
    "Spin Bowling Mentor",
    "Cricket Fitness Trainer",
    "Cricket Coaching Panel",
  ],
  openGraph: {
    title: "Expert Coaches & Mentors | CST Cricket Academy",
    description:
      "Meet our elite panel of BCCI & ICC certified coaches and former first-class cricketers at CST Cricket Academy.",
  },
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
