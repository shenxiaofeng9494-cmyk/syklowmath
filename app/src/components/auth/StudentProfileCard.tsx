"use client";

import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DIMENSION_LABELS,
  getScoreColor,
  getScoreBarBg,
  getScoreBarFill,
  TAG_COLORS,
} from "@/lib/learning-utils";
import type { StudentProfile } from "@/lib/agents/types";

const TREND_LABELS: Record<string, { text: string; icon: string; color: string }> = {
  improving: { text: "进步中", icon: "↑", color: "text-green-400" },
  stable: { text: "稳定", icon: "→", color: "text-yellow-400" },
  declining: { text: "需加油", icon: "↓", color: "text-red-400" },
};

export function StudentProfileCard() {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : { profile: null }))
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, [user, authLoading]);

  if (authLoading || !user || !loaded || !profile) return null;

  const trend = TREND_LABELS[profile.recent_trend] || TREND_LABELS.stable;

  return (
    <section className="mb-12">
      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Overall Score */}
            <div className="flex flex-col items-center justify-center md:min-w-[140px] shrink-0">
              <div
                className="text-5xl font-bold tabular-nums"
                style={{ color: getScoreColor(profile.overall_level) }}
              >
                {profile.overall_level}
              </div>
              <div className="text-sm text-muted-foreground mt-1">综合评分</div>
              <div className={`flex items-center gap-1 mt-2 text-sm ${trend.color}`}>
                <span>{trend.icon}</span>
                <span>{trend.text}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                累计学习 {profile.total_sessions} 次
              </div>
            </div>

            {/* Right: 5 Dimension Bars */}
            <div className="flex-1 space-y-2.5">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                五维能力
              </h4>
              {Object.entries(profile.dimensions).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {DIMENSION_LABELS[key] || key}
                    </span>
                    <span
                      className="font-medium tabular-nums"
                      style={{ color: getScoreColor(value) }}
                    >
                      {value}
                    </span>
                  </div>
                  <div
                    className={`h-2 rounded-full overflow-hidden ${getScoreBarBg(value)}`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getScoreBarFill(value)}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Problem Tags */}
          {profile.recent_problem_tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex flex-wrap gap-2">
                {profile.recent_problem_tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      TAG_COLORS[tag] ||
                      "bg-gray-500/20 text-gray-300 border-gray-500/30"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
