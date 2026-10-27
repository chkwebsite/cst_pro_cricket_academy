import PageHeader from "../components/layout/PageHeader";
import AboutStorySection from "../components/about/AboutStorySection";
import VisionMissionSection from "../components/about/VisionMissionSection";
import CoreValuesSection from "../components/about/CoreValuesSection";
import FacilitiesSection from "../components/about/FacilitiesSection";

export const metadata = {
  title: "About Us | ST Cricket Academy",
  description: "Learn about ST Cricket Academy, our vision, values and facilities.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About Us"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="About Us"
      />
      <AboutStorySection />
      <VisionMissionSection />
      <CoreValuesSection />
      <FacilitiesSection />
    </>
  );
}
