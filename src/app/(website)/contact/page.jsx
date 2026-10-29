import PageHeader from "../components/layout/PageHeader";
import ContactFormSection from "../components/contact/ContactFormSection";
import GoogleMapSection from "../components/contact/GoogleMapSection";

export const metadata = {
  title: "Contact Us & Admission Enquiries | CST Cricket Academy",
  description:
    "Get in touch with CST Cricket Academy. Enquire about admissions, program batches, book trial sessions, or schedule turf grounds. Call or visit our coaching centers today.",
  keywords: [
    "Contact Cricket Academy",
    "Cricket Academy Phone Number",
    "Cricket Admission Enquiry",
    "Cricket Academy Address",
    "Cricket Ground Enquiry",
    "Join Cricket Academy",
  ],
  openGraph: {
    title: "Contact Us & Admission Enquiries | CST Cricket Academy",
    description:
      "Get in touch with CST Cricket Academy for admissions, trial sessions, and ground bookings.",
  },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        title="Contact Us"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Contact Us"
      />
      <ContactFormSection />
      <GoogleMapSection />
    </>
  );
}
