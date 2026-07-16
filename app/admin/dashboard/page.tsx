import fs from "node:fs";
import path from "node:path";

import { AdminDashboard } from "@/components/admin/AdminDashboard";

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1300;

export default function AdminDashboardPage() {
  const mapSvg = fs.readFileSync(path.join(process.cwd(), "public/map/campus.svg"), "utf-8");

  return <AdminDashboard mapSvg={mapSvg} mapWidth={MAP_WIDTH} mapHeight={MAP_HEIGHT} />;
}
