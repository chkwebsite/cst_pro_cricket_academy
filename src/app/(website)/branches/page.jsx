import PageHeader from "../components/layout/PageHeader";
import BranchesGridSection from "../components/branches/BranchesGridSection";
import BranchFacilitiesSection from "../components/branches/BranchFacilitiesSection";
import BranchScheduleSection from "../components/branches/BranchScheduleSection";
import BranchVisitGuideSection from "../components/branches/BranchVisitGuideSection";
import BranchFaqSection from "../components/branches/BranchFaqSection";
import BranchCtaSection from "../components/branches/BranchCtaSection";

export const metadata = {
  title: "Our Branches | CST Pro Cricket Academy",
  description:
    "Explore CST Pro Cricket Academy training campuses in Gurugram. State-of-the-art turf pitches, bowling machines, floodlit nets, certified coaching batches, and hostel facilities.",
};

export default function BranchesPage() {
  return (
    <>
      <PageHeader
        title="Our Branches"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Branches"
      />

      {/* 1. Branch Locator & Cards Grid */}
      <BranchesGridSection />

      {/* 2. World-Class Infrastructure & Amenities */}
      <BranchFacilitiesSection />

      {/* 3. Universal Batch Timings & Training Schedule */}
      <BranchScheduleSection />

      {/* 4. How to Visit & Enroll (Step-by-Step Guide) */}
      <BranchVisitGuideSection />

      {/* 5. Branch Frequently Asked Questions */}
      <BranchFaqSection />

      {/* 6. High-Converting Call to Action Banner */}
      <BranchCtaSection />
    </>
  );
}
