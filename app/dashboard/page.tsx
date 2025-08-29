export default function DashboardPage() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2 text-left">Pos</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-left">Manager</th>
            <th className="px-4 py-2 text-left">GW Points</th>
            <th className="px-4 py-2 text-left">Transfers</th>
            <th className="px-4 py-2 text-left">Hit</th>
            <th className="px-4 py-2 text-left">Bench Points</th>
            <th className="px-4 py-2 text-left">Total Points</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2">1</td>
            <td className="px-4 py-2">Melchester Rovers</td>
            <td className="px-4 py-2">Simon Hodgkinson</td>
            <td className="px-4 py-2">68</td>
            <td className="px-4 py-2">3</td>
            <td className="px-4 py-2">-4</td>
            <td className="px-4 py-2">15</td>
            <td className="px-4 py-2">168</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}