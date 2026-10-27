import HeroSection from "./components/home/HeroSection";
import StatsSection from "./components/home/StatsSection";
import AboutSection from "./components/home/AboutSection";
import ProgramsSection from "./components/home/ProgramsSection";
import WhyChooseUsSection from "./components/home/WhyChooseUsSection";
import BranchesSection from "./components/home/BranchesSection";
import CoachesSection from "./components/home/CoachesSection";
import GallerySection from "./components/home/GallerySection";
import TestimonialsSection from "./components/home/TestimonialsSection";
import AdmissionStepsSection from "./components/home/AdmissionStepsSection";
import FaqSection from "./components/home/FaqSection";
import CtaSection from "./components/home/CtaSection";

export const metadata = {
  title: "ST Cricket Academy | Professional Cricket Coaching",
  description:
    "ST Cricket Academy offers professional cricket coaching for all ages with expert coaches, turf pitches and a structured player development programme.",
};

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Stats Counter Section */}
      <StatsSection />

      {/* About Section */}
      <AboutSection />

      {/* Coaching Programs Section */}
      <ProgramsSection />

      {/* Why Choose Us Section */}
      <WhyChooseUsSection />

      {/* Our Branches Section */}
      <BranchesSection />

      {/* Coaches Preview Section */}
      <CoachesSection />

      {/* Gallery Section */}
      <GallerySection />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* How to Join / 3 Steps Section */}
      <AdmissionStepsSection />

      {/* FAQ Section */}
      <FaqSection />

      {/* Call to Action Section */}
      <CtaSection />
    </>
  );
}
