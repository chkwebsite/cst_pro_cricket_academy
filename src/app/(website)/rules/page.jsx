import PageHeader from "../components/layout/PageHeader";
import RulesListSection from "../components/rules/RulesListSection";

export const metadata = {
  title: "Rules & Regulations | ST Cricket Academy",
  description:
    "Academy code of conduct, dress code, safety, attendance, and guidelines for students and parents.",
};

export default function RulesPage() {
  return (
    <>
      <PageHeader
        title="Rules & Regulations"
        breadcrumbs={[{ label: "Home", href: "/" }]}
        current="Rules & Regulations"
      />
      <RulesListSection />
    </>
  );
}
