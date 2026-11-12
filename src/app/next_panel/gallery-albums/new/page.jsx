import GalleryAlbumForm from "../GalleryAlbumForm";

export const metadata = {
    title: "New Gallery Album | ST Academy Panel",
};

export default async function NewGalleryAlbumPage({ searchParams }) {
    const sp = await searchParams;
    return <GalleryAlbumForm defaultCategoryId={sp?.category_id || ""} />;
}
