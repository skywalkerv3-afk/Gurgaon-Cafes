import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function classify(tags: Record<string, string>) {
  if (tags.shop === "bakery") return "Bakery" as const;
  if (tags.amenity === "restaurant") return "Restaurant" as const;
  if (tags.cuisine?.includes("coffee") || tags.coffee === "yes") return "Coffee shop" as const;
  return "Cafe" as const;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const south = Number(searchParams.get("south") ?? 28.35);
  const west = Number(searchParams.get("west") ?? 76.85);
  const north = Number(searchParams.get("north") ?? 28.58);
  const east = Number(searchParams.get("east") ?? 77.18);
  if (![south, west, north, east].every(Number.isFinite) ||
      south >= north || west >= east || north - south > 1 || east - west > 1) {
    return NextResponse.json({ error: "Invalid map bounds" }, { status: 400 });
  }
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:25];(
    nwr["amenity"~"^(cafe|coffee_shop|restaurant)$"](${bbox});
    nwr["shop"="coffee"](${bbox});
    nwr["shop"="bakery"](${bbox});
  );out center tags;`;
  let lastError = "Cafe data provider unavailable";
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "GurgaonCafeExplorer3D/1.0" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(30000),
        next: { revalidate: 300 },
      });
      if (!response.ok) { lastError = `OpenStreetMap provider returned ${response.status}`; continue; }
      const payload = await response.json();
      const seen = new Set<string>();
      const cafes = (payload.elements ?? []).flatMap((el: any) => {
        const tags = el.tags ?? {};
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!tags.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
        const id = `osm-${el.type}-${el.id}`;
        const dedupe = `${String(tags.name).toLowerCase()}-${Number(lat).toFixed(5)}-${Number(lon).toFixed(5)}`;
        if (seen.has(dedupe)) return [];
        seen.add(dedupe);
        const address = [
          tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"] || tags["addr:neighbourhood"],
          tags["addr:city"] || "Gurugram", tags["addr:postcode"]
        ].filter(Boolean).join(", ") || "Address not listed in OpenStreetMap";
        return [{
          id, name: tags.name, lat, lon, address, category: classify(tags),
          subtype: tags.cuisine || tags.shop || tags.amenity || "Local listing",
          phone: tags.phone || tags["contact:phone"], website: tags.website || tags["contact:website"],
          openingHours: tags.opening_hours, cuisine: tags.cuisine, source: "OpenStreetMap",
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
          tags: Object.entries(tags).filter(([k]) => ["outdoor_seating","internet_access","air_conditioning","takeaway","delivery","wheelchair"].includes(k)).map(([k,v]) => `${k}:${v}`)
        }];
      });
      return NextResponse.json({ cafes, source: "OpenStreetMap / Overpass API", fetchedAt: new Date().toISOString(), count: cafes.length });
    } catch (error) { lastError = error instanceof Error ? error.message : lastError; }
  }
  return NextResponse.json({ error: lastError, cafes: [], source: "OpenStreetMap / Overpass API" }, { status: 503 });
}