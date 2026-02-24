import { SignInPanel } from "@/components/common/SignInPanel";
import { sanitizeNextPath } from "@/lib/authNextPath";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next, "/dashboard");

  return <SignInPanel nextPath={nextPath} />;
}
