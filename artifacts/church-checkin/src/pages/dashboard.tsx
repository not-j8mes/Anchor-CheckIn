import { useState } from "react";
import {
  useGetDashboardStats,
  useGetCheckinsByDay,
  useListEvents,
  getGetDashboardStatsQueryKey,
  getGetCheckinsByDayQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, ClipboardList, CheckSquare, CalendarCheck, CalendarDays } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function Dashboard() {
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(undefined);

  const statsParams = selectedEventId ? { eventId: selectedEventId } : undefined;
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(statsParams, {
    query: { queryKey: getGetDashboardStatsQueryKey(statsParams) },
  });
  const { data: chartData, isLoading: chartLoading } = useGetCheckinsByDay(statsParams, {
    query: { queryKey: getGetCheckinsByDayQueryKey(statsParams) },
  });
  const { data: events } = useListEvents();

  const selectedEvent = events?.find((e) => e.id === selectedEventId);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {selectedEvent
              ? `Showing data for "${selectedEvent.name}"`
              : "Overview of your children's ministry"}
          </p>
        </div>

        {/* Event filter */}
        <div className="w-full sm:w-72">
          <Select
            value={selectedEventId ? String(selectedEventId) : "all"}
            onValueChange={(val) =>
              setSelectedEventId(val === "all" ? undefined : Number(val))
            }
          >
            <SelectTrigger className="gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events?.map((ev) => (
                <SelectItem key={ev.id} value={String(ev.id)}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={selectedEventId ? "Registered" : "Total Children"}
          value={stats?.totalChildren}
          icon={<Users className="w-5 h-5 text-primary" />}
          loading={statsLoading}
        />
        <StatCard
          title="Active Forms"
          value={stats?.totalForms}
          icon={<ClipboardList className="w-5 h-5 text-secondary" />}
          loading={statsLoading}
        />
        <StatCard
          title="Checked In Today"
          value={stats?.checkedInToday}
          icon={<CheckSquare className="w-5 h-5 text-green-600" />}
          loading={statsLoading}
        />
        <StatCard
          title="Total Check-ins"
          value={stats?.totalCheckins}
          icon={<CalendarCheck className="w-5 h-5 text-blue-600" />}
          loading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-card-border">
          <CardHeader>
            <CardTitle>Check-ins over time</CardTitle>
            <CardDescription>
              {selectedEvent
                ? `Daily check-in volume for "${selectedEvent.name}" — past 30 days`
                : "Daily check-in volume for the past 30 days"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-[300px] bg-muted/50 rounded-md animate-pulse" />
            ) : chartData && chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                      labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                No check-in data available yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-card-border flex flex-col">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
            <CardDescription>
              {selectedEvent ? `Latest for "${selectedEvent.name}"` : "Latest children added"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {statsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentRegistrations && stats.recentRegistrations.length > 0 ? (
              <div className="space-y-6">
                {stats.recentRegistrations.map((reg) => (
                  <div key={reg.id} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold font-serif">
                      {reg.childFirstName[0]}{reg.childLastName[0]}
                    </div>
                    <div>
                      <p className="font-medium">{reg.childFirstName} {reg.childLastName}</p>
                      <p className="text-sm text-muted-foreground">
                        {reg.guardianName} • {format(new Date(reg.createdAt), "MMM d")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-center py-8">
                No recent registrations
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="shadow-sm border-card-border hover-elevate transition-all">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="p-2 bg-muted rounded-md">{icon}</div>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          ) : (
            <h3 className="text-3xl font-bold font-serif">
              {value !== undefined ? value : "-"}
            </h3>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
