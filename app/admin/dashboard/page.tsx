import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { loadCampusMapData } from "@/lib/campusMapData";

export default function AdminDashboardPage() {
  const { svg: mapSvg, width: mapWidth, height: mapHeight, buildingLabels } = loadCampusMapData();

  return <AdminDashboard mapSvg={mapSvg} mapWidth={mapWidth} mapHeight={mapHeight} buildingLabels={buildingLabels} />;
}
