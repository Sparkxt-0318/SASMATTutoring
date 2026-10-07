import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The code page moved: member sign in is now one page, /member/login. */
export default async function MemberCodeRedirect({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  redirect(email ? `/member/login?email=${encodeURIComponent(email)}` : "/member/login");
}
