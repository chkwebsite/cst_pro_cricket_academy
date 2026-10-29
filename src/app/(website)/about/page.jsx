import PageHeader from "../components/layout/PageHeader";
import AboutStorySection from "../components/about/AboutStorySection";
import VisionMissionSection from "../components/about/VisionMissionSection";
import CoreValuesSection from "../components/about/CoreValuesSection";
import FacilitiesSection from "../components/about/FacilitiesSection";

export const metadata = {
  title: "About Us | CST Cricket Academy",
  description:
    "Discover the vision, journey, and core values of CST Cricket Academy. Dedicated to nurturing grassroots talent into professional cricketers with world-class facilities and expert mentorship.",
  keywords: [
    "About CST Cricket Academy",
    "Cricket Academy History",
    "Cricket Training Philosophy",
    "BCCI Certified Mentors",
    "Grassroots Cricket Development",
    "Cricket Excellence Center",
  ],
  openGraph: {
    title: "About Us | CST Cricket Academy",
    description:
      "Discover the vision, journey, and core values of CST Cricket Academy. Dedicated to nurturing grassroots talent into professional cricketers.",
  },
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
