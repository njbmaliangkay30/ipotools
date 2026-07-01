"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export default function NewIPOForm() {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In v1, we will insert to Supabase here
    // For now we just route back to dashboard
    router.push("/");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add New IPO</CardTitle>
          <CardDescription>Input IPO data manually from prospectus</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker</Label>
                  <Input id="ticker" placeholder="e.g. GOTO" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nama">Company Name</Label>
                  <Input id="nama" placeholder="PT GoTo Gojek Tokopedia Tbk" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sektor">Sector</Label>
                  <Input id="sektor" placeholder="Technology" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select defaultValue="upcoming">
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active (Bookbuilding/Offering)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-destructive">Insider Risk Data</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="founder_price">Founder Avg Price</Label>
                  <Input id="founder_price" type="number" placeholder="Rp" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipo_price">IPO Price</Label>
                  <Input id="ipo_price" type="number" placeholder="Rp" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="free_float">Free Float (%)</Label>
                  <Input id="free_float" type="number" step="0.1" placeholder="%" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fund_usage">Fund Usage Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select usage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="growth_capex">Growth / Capex</SelectItem>
                      <SelectItem value="debt_repayment">Debt Repayment</SelectItem>
                      <SelectItem value="divestasi">Divestment (Exit)</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit">Save IPO</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
