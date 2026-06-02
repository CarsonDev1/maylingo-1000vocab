"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setDailyGoal } from "@/lib/actions";

export function SettingsClient({ goal }: { goal: number }) {
  const [value, setValue] = useState(goal);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setDailyGoal(value);
      toast.success("Daily goal saved");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily goal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            How many words you want to learn/review each day to keep your streak.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="goal">Words / day</Label>
              <Input
                id="goal"
                type="number"
                min={5}
                max={200}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-32"
              />
            </div>
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manage your profile, email and sign out via the account button in the sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
