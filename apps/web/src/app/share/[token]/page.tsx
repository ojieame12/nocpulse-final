import { ShareLandingScreen } from "../../../features/auth/ShareLandingScreen";

type SharePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;

  return <ShareLandingScreen token={token} />;
}
