import GalleryCategoryForm from "../../GalleryCategoryForm";

export const metadata = {
    title: "Edit Gallery Category | ST Academy Panel",
};

export default async function EditGalleryCategoryPage({ params }) {
    const { id } = await params;
    return <GalleryCategoryForm id={id} />;
}
