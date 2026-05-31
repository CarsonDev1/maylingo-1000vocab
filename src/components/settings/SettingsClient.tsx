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
      toast.success("Đã lưu mục tiêu hằng ngày");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mục tiêu hằng ngày</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Số từ bạn muốn học/ôn mỗi ngày để giữ chuỗi streak.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="goal">Số từ / ngày</Label>
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
              {pending ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Quản lý hồ sơ, email và đăng xuất qua nút tài khoản ở thanh bên.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
