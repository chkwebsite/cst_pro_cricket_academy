import PlayerPaymentForm from "../../PlayerPaymentForm";

export const metadata = {
    title: "Edit Payment | CST Cricket Academy",
};

export default async function EditPaymentPage({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid py-4">
            <PlayerPaymentForm id={id} />
        </div>
    );
}
