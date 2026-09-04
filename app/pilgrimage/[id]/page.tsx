import { pilgrimageStops } from "@/lib/pilgrimage-data";
import PilgrimageStoryClient from "./story-client";

export default async function PilgrimageStoryPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const stop = pilgrimageStops.find((item) => item.id === id);
	return <PilgrimageStoryClient stopId={stop?.id ?? ""} />;
}
