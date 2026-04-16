import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
}

export function KpiCard({ title, value, description, icon: Icon }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  );
}
