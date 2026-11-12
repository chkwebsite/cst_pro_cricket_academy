import PlayerProgramFeeForm from "../../PlayerProgramFeeForm";

export const metadata = {
    title: "Edit Fee Invoice | CST Cricket Academy",
};

export default async function EditPlayerProgramFeePage({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid py-4">
            <PlayerProgramFeeForm id={id} />
        </div>
    );
}
