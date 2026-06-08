import { PageHeader } from "@/components/shared/PageHeader";
import { SectionDetail } from "@/components/home/SectionDetail";

export default async function CustomSectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;
  return (
    <>
      <PageHeader title="Custom section" />
      <SectionDetail sectionId={sectionId} />
    </>
  );
}
