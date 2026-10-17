import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { setMemberActive } from "@/lib/actions/members";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Notice, type NoticeParams } from "@/components/Notice";
import { AddMemberForm } from "./AddMemberForm";
import { TestAccessForm } from "./TestAccessForm";
import { ImportMembersForm } from "./ImportMembersForm";
import { formatDate } from "@/lib/constants";

export const metadata: Metadata = { title: "Members" };

export default async function AdminMembersPage({ searchParams }: { searchParams: NoticeParams }) {
  await requireAdmin();
  const params = await searchParams;
  const members = await prisma.member.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { claimedRequests: true } } },
  });

  const activeCount = members.filter((m) => m.active).length;

  return (
    <div>
      <Notice notice={params.notice} n={params.n} />
      <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        This is the member list. Everyone active here gets an email when a tutoring request
        arrives, and can sign in at /member/login with a one-time code sent to their email.
        Nobody else can sign in. Deactivate someone to stop both.
      </p>
      <p className="mt-3 text-sm font-medium">
        {activeCount} active {activeCount === 1 ? "member" : "members"}
      </p>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <AddMemberForm />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <ImportMembersForm />
      </div>

      {activeCount > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <TestAccessForm members={members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }))} />
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline/60 text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3.5 font-semibold">Name</th>
              <th className="px-5 py-3.5 font-semibold">Email</th>
              <th className="px-5 py-3.5 font-semibold">Claims</th>
              <th className="px-5 py-3.5 font-semibold">Joined</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              <th className="px-5 py-3.5 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted">
                  No members yet. Add your roster above.
                </td>
              </tr>
            )}
            {members.map((member) => (
              <tr key={member.id} className="border-b border-hairline/40 align-top last:border-0">
                <td className="px-5 py-3.5 font-medium">{member.name}</td>
                <td className="px-5 py-3.5 text-muted">{member.email}</td>
                <td className="px-5 py-3.5">{member._count.claimedRequests}</td>
                <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                  {formatDate(member.createdAt)}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.active ? "bg-green-50 text-green-700" : "bg-surface text-muted"
                    }`}
                  >
                    {member.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-start justify-end">
                    {member.active ? (
                      <ConfirmButton
                        label="Deactivate"
                        confirmLabel="Deactivate"
                        question="They are signed out, get no more emails, and their upcoming sessions go back to the other members."
                        action={setMemberActive.bind(null, member.id, false)}
                      />
                    ) : (
                      <form action={setMemberActive.bind(null, member.id, true)}>
                        <button type="submit" className="text-accent hover:underline">
                          Reactivate
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
