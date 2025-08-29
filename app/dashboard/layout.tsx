import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Topbar */}
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">The James Family League</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Stats cards row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Points</p>
            <h2 className="text-2xl font-bold">56</h2>
            <p className="text-sm">Simon Hodgkinson</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Fewest Points</p>
            <h2 className="text-2xl font-bold">24</h2>
            <p className="text-sm">Matt James</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Bench Points</p>
            <h2 className="text-2xl font-bold">15</h2>
            <p className="text-sm">Matt James</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Most Transfers</p>
            <h2 className="text-2xl font-bold">3</h2>
            <p className="text-sm">Matt James</p>
          </Card>
        </div>

        {/* Tabs for League Table / Transfers / Chips */}
        <Tabs defaultValue="league">
          <TabsList>
            <TabsTrigger value="league">League Table</TabsTrigger>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="chips">Chips</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Page content */}
        <div>{children}</div>
      </main>
    </div>
  );
}