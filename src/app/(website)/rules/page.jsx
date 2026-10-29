import PageHeader from "../components/layout/PageHeader";
import RulesListSection from "../components/rules/RulesListSection";

export const metadata = {
  title: "Rules, Guidelines & Code of Conduct | CST Cricket Academy",
  description:
    "Review official academy rules, student and parent code of conduct, kit and uniform guidelines, discipline standards, attendance rules, and ground safety policies at CST Cricket Academy.",
  keywords: [
    "Cricket Academy Rules",
    "Cricket Code of Conduct",
    "Academy Safety Guidelines",
    "Cricket Uniform Policy",
    "Student Discipline Policy",
    "Ground Usage Regulations",
  ],
  openGraph: {
    title: "Rules, Guidelines & Code of Conduct | CST Cricket Academy",
    description:
      "Review official academy rules, code of conduct, uniform guidelines, and safety policies at CST Cricket Academy.",
  },
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
