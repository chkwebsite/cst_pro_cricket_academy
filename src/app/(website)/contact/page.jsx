import PageHeader from "../components/layout/PageHeader";
import ContactFormSection from "../components/contact/ContactFormSection";
import GoogleMapSection from "../components/contact/GoogleMapSection";
import FaqSection from "../components/home/FaqSection";
import CtaSection from "../components/home/CtaSection";

export const metadata = {
  title: "Contact & Book a Free Trial | CST Cricket Academy",
  description:
    "Book a free trial or contact CST Cricket Academy. World-class cricket coaching in Gurugram, Haryana.",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Contact &amp; Book a Free Trial"
        eyebrow="Get in Touch"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Contact Us"
      />
      <ContactFormSection />
      <GoogleMapSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
