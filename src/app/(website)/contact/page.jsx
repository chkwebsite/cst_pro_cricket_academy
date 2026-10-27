import PageHeader from "../components/layout/PageHeader";
import ContactFormSection from "../components/contact/ContactFormSection";
import GoogleMapSection from "../components/contact/GoogleMapSection";

export const metadata = {
  title: "Contact Us | ST Cricket Academy",
  description:
    "Get in touch with ST Cricket Academy. Book a free trial, enquire about admissions or visit our campuses.",
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
