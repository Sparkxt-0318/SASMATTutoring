import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { setMemberActive } from "@/lib/actions/members";
import { AddMemberForm } from "./AddMemberForm";
import { formatDate } from "@/lib/constants";

export const metadata: Metadata = { title: "Members" };

export default async function AdminMembersPage() {
  const members = await prisma.member.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { claimedRequests: true } } },
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
      <p className="mt-1 text-sm text-muted">
        Everyone on this roster gets an email when a tutoring request arrives.
      </p>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <AddMemberForm />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
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
                  No members yet — add your roster above.
                </td>
              </tr>
            )}
            {members.map((member) => (
              <tr key={member.id} className="border-b border-hairline/40 last:border-0">
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
                <td className="px-5 py-3.5 text-right">
                  <form action={setMemberActive.bind(null, member.id, !member.active)}>
                    <button
                      type="submit"
                      className={member.active ? "text-red-600 hover:underline" : "text-accent hover:underline"}
                    >
                      {member.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
