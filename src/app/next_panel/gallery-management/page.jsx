import { Film, FolderTree, Images, Video } from "lucide-react";
import ManagementHub from "../components/ManagementHub";

const sections = [
    {
        title: "Gallery Categories",
        description: "Organize photos and videos into categories like Matches, Training, Events, and Tournaments.",
        href: "/next_panel/gallery-categories",
        createHref: "/next_panel/gallery-categories/new",
        Icon: FolderTree,
    },
    {
        title: "Gallery Albums",
        description: "Create event-based or date-based albums associated with academies and branches.",
        href: "/next_panel/gallery-albums",
        createHref: "/next_panel/gallery-albums/new",
        Icon: Film,
    },
    {
        title: "Gallery Images",
        description: "Upload and manage photos with captions, alt text, and sorting order for each album.",
        href: "/next_panel/gallery-images",
        createHref: "/next_panel/gallery-images/new",
        Icon: Images,
    },
    {
        title: "Gallery Videos",
        description: "Manage videos from YouTube, Vimeo or direct video uploads with custom thumbnails.",
        href: "/next_panel/gallery-videos",
        createHref: "/next_panel/gallery-videos/new",
        Icon: Video,
    },
];

export default function GalleryManagementPage() {
    return (
        <ManagementHub
            title="Gallery Management"
            description="Manage media categories, albums, high-resolution photos, and videos."
            activeHref="/next_panel/gallery-management"
            sections={sections}
        />
    );
}
