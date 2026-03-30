import { AuthNoticeScreen } from "./AuthNoticeScreen";
import { CreateWorkspaceForm } from "./CreateWorkspaceForm";

type CreateWorkspaceScreenProps = {
  nextPath?: string;
};

export function CreateWorkspaceScreen({
  nextPath = "/",
}: CreateWorkspaceScreenProps) {
  return (
    <AuthNoticeScreen
      eyebrow="Workspace Setup"
      title="Create your first workspace"
      description="This will provision a workspace and add your authenticated account as the owner so the normal NocPulse actor flow can resolve on the next request."
      detail="Use the name your team will recognize. The workspace slug is generated automatically and made unique if another workspace already uses the same label."
      footer="If you expected to join an existing workspace instead, go back and request access from that workspace owner."
    >
      <CreateWorkspaceForm nextPath={nextPath} />
    </AuthNoticeScreen>
  );
}
