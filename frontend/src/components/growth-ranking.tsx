'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { GrowthItem } from '@/lib/api';

interface GrowthRankingProps {
  title: string;
  items: GrowthItem[];
  type: 'top' | 'bottom';
}

export function GrowthRanking({ title, items, type }: GrowthRankingProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {type === 'top' ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, i) => (
            <Link
              key={item.asesoriaId}
              href={`/asesorias/${item.asesoriaId}`}
              className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{item.nombre}</p>
                  <p className="text-xs text-muted-foreground">{item.provincia}</p>
                </div>
              </div>
              <span
                className={`text-sm font-semibold ${
                  (item.growthPct ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(item.growthPct ?? 0) >= 0 ? '+' : ''}
                {item.growthPct?.toFixed(1)}%
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
