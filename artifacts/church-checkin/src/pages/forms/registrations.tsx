import { useParams, Link } from "wouter";
import { useListRegistrations, useGetForm } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";

export default function FormRegistrations() {
  const params = useParams<{ id: string }>();
  const formId = parseInt(params.id || "0", 10);

  const { data: form } = useGetForm(formId);
  const { data: registrations, isLoading } = useListRegistrations(formId);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/forms"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Registrations</h1>
            <p className="text-muted-foreground mt-1">Form: {form?.title || "Loading..."}</p>
          </div>
        </div>
        <Button variant="outline" disabled={!registrations?.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card className="border-card-border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading registrations...</div>
          ) : registrations && registrations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child Name</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Date Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium text-foreground">
                      {reg.childFirstName} {reg.childLastName}
                    </TableCell>
                    <TableCell>{reg.guardianName}</TableCell>
                    <TableCell>{reg.guardianPhone}</TableCell>
                    <TableCell>{reg.room || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(reg.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No registrations yet"
              description="When families fill out this form, their submissions will appear here."
              icon={<FileText className="w-8 h-8" />}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}