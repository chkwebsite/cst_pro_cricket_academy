import PlayerProgramFeeForm from "../PlayerProgramFeeForm";

export const metadata = {
    title: "Generate Monthly Fee | CST Cricket Academy",
};

export default function NewPlayerProgramFeePage() {
    return (
        <div className="container-fluid py-4">
            <PlayerProgramFeeForm />
        </div>
    );
}
