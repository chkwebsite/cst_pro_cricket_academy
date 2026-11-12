import PageLoader from "./components/PageLoader";

export default function Loading() {
    return (
        <PageLoader
            message="Loading Page"
            subtitle="Please wait while the page is preparing..."
            overlay={false}
        />
    );
}
