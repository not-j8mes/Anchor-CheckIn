import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed shadow-none bg-transparent">
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-full mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-serif font-bold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground max-w-md mb-6">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
