"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { Search, LocateFixed, SlidersHorizontal, Heart, Coffee, X, MapPin, Navigation, Star, Clock3, ExternalLink, Layers3, Compass, ListFilter, ArrowUpDown, ChevronRight, Map as MapIcon, Locate, Bookmark, Plus, Minus, RotateCcw } from "lucide-react";
import type { Cafe } from "@/lib/types";

const AREAS = [
  ["Cyber City",28.4957,77.0889],["Golf Course Road",28.4595,77.1012],["Golf Course Extension",28.4245,77.0685],
  ["Sector 29",28.4698,77.0645],["Sector 14",28.4697,77.0418],["Sector 31",28.4507,77.0477],
  ["Sector 43",28.4551,77.0958],["Sector 50",28.4237,77.0587],["Sector 56",28.4241,77.0997],
  ["Sector 57",28.4176,77.0821],["Galleria Market",28.4671,77.0932],["South Point Mall",28.4337,77.1016],
  ["One Horizon Center",28.4597,77.1011],["Worldmark",28.5225,77.0407],["Udyog Vihar",28.5048,77.0852],
  ["MG Road",28.4796,77.0805],["Sohna Road",28.4075,77.0432],["Sushant Lok",28.4593,77.0853],
  ["DLF Phase 1",28.4758,77.1030],["DLF Phase 2",28.4908,77.0920],["DLF Phase 3",28.4948,77.1007],
  ["DLF Phase 4",28.4550,77.0901],["DLF Phase 5",28.4590,77.1010],["Palam Vihar",28.5151,77.0331],
  ["New Gurgaon",28.4050,76.9900]
] as const;

type ApiResponse = { cafes: Cafe[]; fetchedAt?: string; source?: string; error?: string };
const fmtDistance = (n?: number) => n == null ? "—" : n < 1 ? `${Math.round(n*1000)} m` : `${n.toFixed(1)} km`;
const distance = (a:number,b:number,c:number,d:number) => {
  const r = Math.PI/180, x=(c-a)*r, y=(d-b)*r;
  const h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};

export default function CafeExplorer() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap|null>(null);
  const cafesRef = useRef<Cafe[]>([]);
  const [cafes,setCafes] = useState<Cafe[]>([]);
  const [selected,setSelected] = useState<Cafe|null>(null);
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("All");
  const [distanceLimit,setDistanceLimit] = useState(10);
  const [ratingFilter,setRatingFilter] = useState("Any");
  const [openOnly,setOpenOnly] = useState(false);
  const [sort,setSort] = useState("nearest");
  const [userPos,setUserPos] = useState<[number,number]|null>(null);
  const [gpsMessage,setGpsMessage] = useState("Location not shared");
  const [gpsWatch,setGpsWatch] = useState(false);
  const [favorites,setFavorites] = useState<string[]>([]);
  const [compare,setCompare] = useState<string[]>([]);
  const [showFilters,setShowFilters] = useState(false);
  const [showList,setShowList] = useState(false);
  const [is3d,setIs3d] = useState(true);
  const [loading,setLoading] = useState(true);
  const [dataError,setDataError] = useState("");
  const [lastRefresh,setLastRefresh] = useState("");
  const [nearbyOnly,setNearbyOnly] = useState(false);

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem("gce-favs") || "[]")); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("gce-favs",JSON.stringify(favorites)); },[favorites]);

  const fetchCafes = useCallback(async (map:MapLibreMap) => {
    const b=map.getBounds();
    setLoading(true);
    try {
      const params=new URLSearchParams({south:String(b.getSouth()),west:String(b.getWest()),north:String(b.getNorth()),east:String(b.getEast())});
      const res=await fetch(`/api/cafes?${params}`);
      const data:ApiResponse=await res.json();
      if(!res.ok) throw new Error(data.error || "Cafe data is temporarily unavailable");
      const enriched=(data.cafes||[]).map(c=>({...c,distanceKm:userPos?distance(userPos[1],userPos[0],c.lat,c.lon):undefined}));
      cafesRef.current=enriched; setCafes(enriched); setLastRefresh(data.fetchedAt||""); setDataError("");
    } catch(e) { setDataError(e instanceof Error?e.message:"Unable to load cafe listings"); }
    finally { setLoading(false); }
  },[userPos]);

  useEffect(() => {
    if(!mapNode.current || mapRef.current) return;
    const key=process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const style=key
      ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`
      : {
          version:8 as const,
          sources:{osm:{type:"raster" as const,tiles:["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png","https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256,attribution:"© OpenStreetMap contributors"}},
          layers:[{id:"osm",type:"raster" as const,source:"osm"}]
        };
    const map=new maplibregl.Map({container:mapNode.current,style,center:[77.05,28.46],zoom:11.5,pitch: is3d?55:0,bearing:-12,antialias:true,attributionControl:true});
    mapRef.current=map;
    map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"bottom-right");
    map.addControl(new maplibregl.ScaleControl({unit:"metric"}),"bottom-left");
    map.on("load",()=>{
      if(key) {
        map.addSource("openmaptiles",{url:`https://api.maptiler.com/tiles/v3/tiles.json?key=${key}`,type:"vector"});
        const layers=map.getStyle().layers||[];
        const label=layers.find(l=>l.type==="symbol");
        map.addLayer({id:"3d-buildings",source:"openmaptiles","source-layer":"building",type:"fill-extrusion",minzoom:14,
          paint:{"fill-extrusion-color":"#263746","fill-extrusion-height":["coalesce",["get","render_height"],["get","height"],8],"fill-extrusion-base":["coalesce",["get","render_min_height"],0],"fill-extrusion-opacity":0.82}},label?.id);
      }
      map.addSource("cafes",{type:"geojson",data:{type:"FeatureCollection",features:[]},cluster:true,clusterRadius:48,clusterMaxZoom:14});
      map.addLayer({id:"cafe-clusters",type:"circle",source:"cafes",filter:["has","point_count"],paint:{"circle-color":"#d6a66a","circle-radius":["step",["get","point_count"],17,10,22,30,28],"circle-opacity":0.9,"circle-stroke-width":2,"circle-stroke-color":"#201a16"}});
      map.addLayer({id:"cafe-cluster-count",type:"symbol",source:"cafes",filter:["has","point_count"],layout:{"text-field":"{point_count_abbreviated}","text-size":12},paint:{"text-color":"#1b1713"}});
      map.addLayer({id:"cafe-points",type:"circle",source:"cafes",filter:["!",["has","point_count"]],paint:{"circle-radius":7,"circle-color":["match",["get","category"],"Coffee shop","#b5c9b7","Bakery","#e9c18a","Restaurant","#bd9acb","#d6a66a"],"circle-stroke-color":"#15191b","circle-stroke-width":2}});
      map.on("click","cafe-points",(e)=>{
        const f=e.features?.[0]; if(!f) return;
        const cafe=cafesRef.current.find(c=>c.id===f.properties?.id);
        if(cafe) setSelected(cafe);
      });
      map.on("click","cafe-clusters",(e)=>{
        const f=e.features?.[0]; if(!f) return;
        const source=map.getSource("cafes") as GeoJSONSource;
        source.getClusterExpansionZoom(Number(f.properties?.cluster_id),(err,zoom)=>{
          if(!err) map.easeTo({center:(f.geometry as any).coordinates,zoom:zoom+0.3,duration:650});
        });
      });
      map.on("mouseenter","cafe-points",()=>map.getCanvas().style.cursor="pointer");
      map.on("mouseleave","cafe-points",()=>map.getCanvas().style.cursor="");
      fetchCafes(map);
    });
    let timer:ReturnType<typeof setTimeout>;
    map.on("moveend",()=>{clearTimeout(timer);timer=setTimeout(()=>fetchCafes(map),350);});
    return ()=>{clearTimeout(timer);map.remove();mapRef.current=null;};
  },[]);

  useEffect(()=>{
    const map=mapRef.current; if(!map || !map.isStyleLoaded()) return;
    const source=map.getSource("cafes") as GeoJSONSource|undefined; if(!source) return;
    source.setData({type:"FeatureCollection",features:cafes.map(c=>({type:"Feature",geometry:{type:"Point",coordinates:[c.lon,c.lat]},properties:{id:c.id,category:c.category}}))});
  },[cafes]);

  useEffect(()=>{
    const map=mapRef.current; if(!map) return;
    map.easeTo({pitch:is3d?55:0,duration:800});
  },[is3d]);

  useEffect(()=>{
    if(!userPos) return;
    setCafes(prev=>prev.map(c=>({...c,distanceKm:distance(userPos[1],userPos[0],c.lat,c.lon)})));
  },[userPos]);

  const visible = useMemo(()=>{
    let list=cafes.filter(c=>{
      const text=`${c.name} ${c.address} ${c.category} ${c.subtype}`.toLowerCase();
      if(query && !text.includes(query.toLowerCase())) return false;
      if(category!=="All" && c.category!==category) return false;
      if(userPos && (nearbyOnly || distanceLimit<10) && (c.distanceKm??99)>distanceLimit) return false;
      // Rating/open-now filters remain informational until a licensed provider and hours parser are connected.
      return true;
    });
    if(sort==="nearest" && userPos) list.sort((a,b)=>(a.distanceKm??99)-(b.distanceKm??99));
    if(sort==="price") list.sort((a,b)=>(a.priceLevel??99)-(b.priceLevel??99));
    return list;
  },[cafes,query,category,userPos,nearbyOnly,distanceLimit,ratingFilter,openOnly,sort]);

  const locate=()=>{
    if(!navigator.geolocation){setGpsMessage("GPS is not supported by this browser");return;}
    setGpsMessage("Requesting location permission…");
    navigator.geolocation.getCurrentPosition(pos=>{
      const p:[number,number]=[pos.coords.longitude,pos.coords.latitude];
      setUserPos(p); setGpsMessage("Your location is active");
      mapRef.current?.flyTo({center:p,zoom:15,pitch:55,duration:1300});
      if(!gpsWatch) {
        navigator.geolocation.watchPosition(next=>setUserPos([next.coords.longitude,next.coords.latitude]),()=>{}, {enableHighAccuracy:true,maximumAge:10000,timeout:20000});
        setGpsWatch(true);
      }
    },err=>setGpsMessage(err.code===1?"Location permission denied. Choose a neighbourhood instead.":"Could not determine location."),{enableHighAccuracy:true,timeout:12000});
  };
  const toggleFavorite=(id:string)=>setFavorites(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleCompare=(id:string)=>setCompare(p=>p.includes(id)?p.filter(x=>x!==id):p.length<3?[...p,id]:p);
  const goArea=(a:typeof AREAS[number])=>mapRef.current?.flyTo({center:[a[2],a[1]],zoom:14.3,pitch:is3d?55:0,duration:1100});
  const selectedCompare=cafes.filter(c=>compare.includes(c.id));
  const googleSearch=(c:Cafe)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name+" "+c.lat+","+c.lon)}`;

  return <main className="app-shell">
    <div ref={mapNode} className="map-canvas" />
    <div className="vignette"/>
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Coffee size={18}/></span><span><b>GURGAON</b><small>CAFE EXPLORER <i>3D</i></small></span></a>
      <div className="search-wrap"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find coffee, a neighbourhood or a hidden gem…"/>{query&&<button onClick={()=>setQuery("")}><X size={16}/></button>}<kbd>⌘ K</kbd></div>
      <div className="top-actions"><span className="live-dot"/> <span className="live-label">CITY GUIDE</span><button className="icon-btn" title="Filters" onClick={()=>setShowFilters(v=>!v)}><SlidersHorizontal size={18}/></button></div>
    </header>
    <aside className="left-rail">
      <div className="rail-heading"><span>EXPLORE THE CITY</span><span className="tiny-count">{visible.length}</span></div>
      <div className="area-list">{AREAS.map(a=><button key={a[0]} onClick={()=>goArea(a)} className="area-btn"><MapPin size={13}/>{a[0]}<ChevronRight size={13}/></button>)}</div>
      <div className="rail-foot"><span className="source-dot"/> OpenStreetMap data <span>·</span> Live viewport</div>
    </aside>
    <div className="map-tools">
      <button className="map-tool" onClick={()=>setIs3d(v=>!v)}><Layers3 size={16}/>{is3d?"3D view":"2D view"}</button>
      <button className="map-tool" onClick={()=>{mapRef.current?.flyTo({center:[77.05,28.46],zoom:11.5,pitch:is3d?55:0,bearing:-12,duration:1000});}}><RotateCcw size={15}/>Reset</button>
      <button className="map-tool" onClick={()=>setShowList(v=>!v)}><ListFilter size={16}/>{showList?"Hide list":"Cafe list"}</button>
    </div>
    <button className="gps-button" onClick={locate}><LocateFixed size={18}/><span>Find cafes near me</span></button>
    <div className="bottom-status"><span>{loading?<><span className="pulse"/> Loading cafes…</>:`${visible.length} places in this view`}</span><span>{lastRefresh?`Updated ${new Date(lastRefresh).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:"Data refreshes as you explore"}</span></div>

    {dataError&&<div className="toast"><span>{dataError}</span><button onClick={()=>mapRef.current&&fetchCafes(mapRef.current)}>Retry</button></div>}
    {gpsMessage!=="Location not shared"&&<div className="gps-toast"><Locate size={14}/>{gpsMessage}</div>}

    {showFilters&&<section className="filter-panel glass">
      <div className="panel-head"><div><small>REFINE YOUR SEARCH</small><h3>Discovery filters</h3></div><button className="icon-btn" onClick={()=>setShowFilters(false)}><X size={17}/></button></div>
      <label>PLACE TYPE</label><div className="chips">{["All","Cafe","Coffee shop","Bakery","Restaurant"].map(v=><button className={category===v?"chip active":"chip"} onClick={()=>setCategory(v)} key={v}>{v}</button>)}</div>
      <label>WITHIN DISTANCE</label><div className="chips">{[0.5,1,2,5,10].map(v=><button key={v} className={distanceLimit===v?"chip active":"chip"} onClick={()=>{setDistanceLimit(v);setNearbyOnly(true);}}>{v<1?"500 m":`${v} km`}</button>)}</div>
      <label>RATING</label><div className="chips">{["Any","3+","3.5+","4+","4.5+"].map(v=><button key={v} className={ratingFilter===v?"chip active":"chip"} onClick={()=>setRatingFilter(v)}>{v}</button>)}</div>
      <p className="muted-note">Ratings and verified open-now status require a licensed business-data source. They are not inferred from map data.</p>
      <label>SORT BY</label><select value={sort} onChange={e=>setSort(e.target.value)}><option value="nearest">Nearest (when GPS is active)</option><option value="rating">Highest rated (requires provider data)</option><option value="reviews">Most reviewed (requires provider data)</option><option value="price">Price (when available)</option></select>
      <button className="reset-filter" onClick={()=>{setCategory("All");setDistanceLimit(10);setNearbyOnly(false);setRatingFilter("Any");setOpenOnly(false);setSort("nearest");}}>Reset filters</button>
    </section>}

    {showList&&<section className="results-panel glass"><div className="panel-head"><div><small>ON THIS MAP</small><h3>{visible.length} places to explore</h3></div><button className="icon-btn" onClick={()=>setShowList(false)}><X size={17}/></button></div><div className="results-scroll">{visible.map(c=><button className="result-row" key={c.id} onClick={()=>{setSelected(c);mapRef.current?.flyTo({center:[c.lon,c.lat],zoom:16,pitch:55,duration:900});}}><span className="result-icon"><Coffee size={15}/></span><span className="result-copy"><b>{c.name}</b><small>{c.category} · {c.address}</small></span><span className="result-distance">{fmtDistance(c.distanceKm)}</span></button>)}</div></section>}

    {selected&&<section className="detail-card glass">
      <div className="detail-cover"><div className="cover-art"><Coffee size={32}/><span>LOCAL COFFEE SPOT</span></div><button className="close-detail" onClick={()=>setSelected(null)}><X size={18}/></button><button className="favorite-detail" onClick={()=>toggleFavorite(selected.id)}><Heart size={18} fill={favorites.includes(selected.id)?"#d7a66d":"none"}/></button></div>
      <div className="detail-content"><div className="eyebrow">{selected.category} <span>·</span> {selected.subtype}</div><h2>{selected.name}</h2>
        <div className="rating-line"><span className="rating-unavailable"><Star size={14}/> Rating unavailable</span><span>·</span><span>{fmtDistance(selected.distanceKm)} away</span></div>
        <p className="address"><MapPin size={15}/>{selected.address}</p>
        <div className="detail-facts"><div><small>HOURS</small><b>{selected.openingHours||"Not listed"}</b></div><div><small>PRICE</small><b>Not listed</b></div><div><small>REVIEWS</small><b>Not listed</b></div></div>
        <div className="detail-actions"><a className="primary-action" href={selected.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation size={15}/> Directions</a><a className="secondary-action" href={googleSearch(selected)} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Google Maps</a></div>
        <div className="detail-links">{selected.phone&&<a href={`tel:${selected.phone}`}>{selected.phone}</a>}{selected.website&&<a href={selected.website} target="_blank" rel="noreferrer">Website <ExternalLink size={12}/></a>}</div>
        <div className="detail-bottom"><button onClick={()=>toggleCompare(selected.id)}><Plus size={14}/>{compare.includes(selected.id)?"Added to compare":"Add to compare"}</button><a href={selected.sourceUrl} target="_blank" rel="noreferrer">OSM source ↗</a></div>
        <p className="data-note">No verified photos or ratings supplied by the current map-data source. Details shown as unavailable are not estimated.</p>
      </div>
    </section>}

    {compare.length>0&&<section className="compare-bar glass"><div><b>{compare.length}/3 selected</b><small>Compare places</small></div>{selectedCompare.map(c=><span key={c.id}>{c.name}</span>)}<button onClick={()=>setCompare([])}>Clear</button></section>}
    <footer className="map-legend"><span><i className="legend-dot cafe"/>Cafe</span><span><i className="legend-dot coffee"/>Coffee shop</span><span><i className="legend-dot bakery"/>Bakery</span><span><i className="legend-dot resto"/>Restaurant</span></footer>
  </main>;
}