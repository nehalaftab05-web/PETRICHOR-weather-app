import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Petrichor — Weather with a personality" },
      {
        name: "description",
        content:
          "A weather app that actually talks to you. Real forecasts plus outfit, activity, and what-to-bring tips.",
      },
      { property: "og:title", content: "Petrichor — Weather with a personality" },
      {
        property: "og:description",
        content: "Real forecasts plus outfit, activity, and what-to-bring tips.",
      },
    ],
  }),
  component: Index,
});

/* ---------- Types ---------- */
type Current = {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  weather_code: number;
  is_day: number;
  uv_index?: number;
  precipitation?: number;
};
type Daily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  sunrise: string[];
  sunset: string[];
  precipitation_probability_max: number[];
};
type Hourly = {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation_probability: number[];
  uv_index: number[];
};
type Place = {
  name: string;
  country: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  timezone?: string;
};

/* ---------- Weather code helpers ---------- */
const CODES: Record<number, { label: string; icon: string; kind: Kind }> = {
  0: { label: "Clear sky", icon: "☀️", kind: "clear" },
  1: { label: "Mainly clear", icon: "🌤️", kind: "clear" },
  2: { label: "Partly cloudy", icon: "⛅", kind: "cloudy" },
  3: { label: "Overcast", icon: "☁️", kind: "cloudy" },
  45: { label: "Fog", icon: "🌫️", kind: "fog" },
  48: { label: "Rime fog", icon: "🌫️", kind: "fog" },
  51: { label: "Light drizzle", icon: "🌦️", kind: "rain" },
  53: { label: "Drizzle", icon: "🌦️", kind: "rain" },
  55: { label: "Heavy drizzle", icon: "🌦️", kind: "rain" },
  61: { label: "Light rain", icon: "🌧️", kind: "rain" },
  63: { label: "Rain", icon: "🌧️", kind: "rain" },
  65: { label: "Heavy rain", icon: "🌧️", kind: "rain" },
  71: { label: "Light snow", icon: "🌨️", kind: "snow" },
  73: { label: "Snow", icon: "❄️", kind: "snow" },
  75: { label: "Heavy snow", icon: "❄️", kind: "snow" },
  80: { label: "Showers", icon: "🌦️", kind: "rain" },
  81: { label: "Showers", icon: "🌧️", kind: "rain" },
  82: { label: "Violent showers", icon: "⛈️", kind: "storm" },
  95: { label: "Thunderstorm", icon: "⛈️", kind: "storm" },
  96: { label: "Thunder + hail", icon: "⛈️", kind: "storm" },
  99: { label: "Severe storm", icon: "⛈️", kind: "storm" },
};
type Kind = "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog";
const desc = (c: number) => CODES[c] ?? { label: "—", icon: "🌡️", kind: "cloudy" as Kind };

const compass = (deg: number) =>
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((deg % 360) / 45) % 8];

/* ---------- Personality: tips, outfit, vibe, activity ---------- */
function buildTips(
  current: Current,
  hourly: Hourly | null,
  daily: Daily | null,
  unit: "C" | "F",
) {
  const toC = (t: number) => (unit === "C" ? t : ((t - 32) * 5) / 9);
  const tC = toC(current.temperature_2m);
  const feelC = toC(current.apparent_temperature);
  const tips: { icon: string; text: string }[] = [];

  // Rain in the next 6 hours
  const next6Pop = hourly
    ? Math.max(...(hourly.precipitation_probability?.slice(0, 6) ?? [0]))
    : 0;
  const todayPop = daily?.precipitation_probability_max?.[0] ?? 0;

  if (next6Pop >= 50 || todayPop >= 60) {
    tips.push({ icon: "☂️", text: "Grab an umbrella — rain is likely soon." });
  } else if (next6Pop >= 30) {
    tips.push({ icon: "🧥", text: "A light jacket wouldn't hurt — showers possible." });
  }

  // Sunshine + UV
  const uv = current.uv_index ?? 0;
  if (uv >= 6 && current.is_day === 1) {
    tips.push({ icon: "🕶️", text: "UV is strong — sunglasses and SPF, please." });
  } else if (uv >= 3 && current.is_day === 1 && desc(current.weather_code).kind === "clear") {
    tips.push({ icon: "😎", text: "It's bright out — sunglasses will feel great." });
  }

  // Heat
  if (feelC >= 30) {
    tips.push({ icon: "💧", text: "Hot day — carry water and pace yourself." });
  } else if (feelC >= 26) {
    tips.push({ icon: "🥤", text: "Warm out. Keep a bottle of water handy." });
  }

  // Cold
  if (feelC <= 0) {
    tips.push({ icon: "🧣", text: "Freezing — bundle up, scarf and gloves weather." });
  } else if (feelC <= 8) {
    tips.push({ icon: "🧥", text: "Chilly — a warm jacket is a good call." });
  } else if (feelC <= 14) {
    tips.push({ icon: "🧶", text: "A light sweater will feel just right." });
  }

  // Wind
  if (current.wind_speed_10m >= 40) {
    tips.push({ icon: "💨", text: "Windy — secure loose things, skip the hat." });
  }

  // Snow / storm
  const kind = desc(current.weather_code).kind;
  if (kind === "snow") tips.push({ icon: "🥾", text: "Snow underfoot — grippy shoes today." });
  if (kind === "storm") tips.push({ icon: "⚡", text: "Storms around — stay indoors if you can." });
  if (kind === "fog") tips.push({ icon: "🚗", text: "Foggy — drive slow, headlights on." });

  // Feel-good default
  if (tips.length === 0) {
    tips.push({ icon: "✨", text: "Honestly? Just go outside. It's perfect." });
  }
  return tips.slice(0, 4);
}

function outfitFor(feelC: number, kind: Kind) {
  if (kind === "storm" || kind === "rain")
    return { icon: "🧥", label: "Waterproof jacket + boots" };
  if (kind === "snow") return { icon: "🧣", label: "Coat, scarf, gloves, boots" };
  if (feelC <= 0) return { icon: "🧥", label: "Heavy coat + thermals" };
  if (feelC <= 8) return { icon: "🧥", label: "Warm jacket + long sleeves" };
  if (feelC <= 14) return { icon: "🧶", label: "Sweater + jeans" };
  if (feelC <= 20) return { icon: "👕", label: "Long sleeve + light layer" };
  if (feelC <= 26) return { icon: "👕", label: "T-shirt weather" };
  return { icon: "🩳", label: "Shorts + shades" };
}

function vibeFor(kind: Kind, feelC: number, isDay: boolean) {
  if (!isDay && kind === "clear") return "Crisp, starry, cinematic.";
  if (kind === "storm") return "Dramatic. Big-sky energy.";
  if (kind === "rain") return "Cozy, contemplative, hot-drink weather.";
  if (kind === "snow") return "Quiet and hushed — the world on mute.";
  if (kind === "fog") return "Mysterious and soft-focus.";
  if (kind === "cloudy") return "Mellow. A good thinking day.";
  if (feelC >= 26) return "Golden-hour bright. Ice cream justified.";
  if (feelC <= 5) return "Sharp and bracing. Bring a friend.";
  return "Fresh and easy — a small joy of a day.";
}

function activityFor(kind: Kind, feelC: number) {
  if (kind === "storm" || kind === "rain")
    return { icon: "📚", label: "Perfect for a book or a long film" };
  if (kind === "snow") return { icon: "☕", label: "Cocoa by a window kind of day" };
  if (feelC >= 25 && (kind === "clear" || kind === "cloudy"))
    return { icon: "🏖️", label: "Park, beach, or patio day" };
  if (kind === "clear") return { icon: "🚶", label: "Great for a long walk" };
  if (kind === "cloudy") return { icon: "☕", label: "Café + slow morning weather" };
  return { icon: "🌿", label: "Get outside for a bit" };
}

/* ---------- Advisories (derived from forecast thresholds) ---------- */
type Advisory = {
  id: string;
  level: "info" | "warn" | "severe";
  title: string;
  detail: string;
  icon: string;
};
function buildAdvisories(
  current: Current,
  hourly: Hourly | null,
  daily: Daily | null,
  unit: "C" | "F",
): Advisory[] {
  const toC = (t: number) => (unit === "C" ? t : ((t - 32) * 5) / 9);
  const out: Advisory[] = [];
  const kind = desc(current.weather_code).kind;

  // Severe weather codes
  if (kind === "storm") {
    out.push({
      id: "storm",
      level: "severe",
      icon: "⛈️",
      title: "Thunderstorm advisory",
      detail: "Lightning and heavy rain are likely. Avoid open areas and tall objects.",
    });
  }

  // Extreme heat
  const feelC = toC(current.apparent_temperature);
  if (feelC >= 38) {
    out.push({
      id: "heat",
      level: "severe",
      icon: "🥵",
      title: "Extreme heat",
      detail: `Feels like ${Math.round(current.apparent_temperature)}°${unit}. Limit outdoor exposure and hydrate constantly.`,
    });
  } else if (feelC >= 32) {
    out.push({
      id: "hot",
      level: "warn",
      icon: "☀️",
      title: "Heat advisory",
      detail: "It's very warm — carry water and take shade breaks.",
    });
  }

  // Extreme cold
  if (feelC <= -10) {
    out.push({
      id: "freeze",
      level: "severe",
      icon: "🥶",
      title: "Extreme cold",
      detail: `Wind chill near ${Math.round(current.apparent_temperature)}°${unit}. Frostbite risk on exposed skin.`,
    });
  } else if (feelC <= 0) {
    out.push({
      id: "cold",
      level: "warn",
      icon: "❄️",
      title: "Freezing conditions",
      detail: "Below freezing — watch for ice on roads and paths.",
    });
  }

  // High wind
  if (current.wind_speed_10m >= 60) {
    out.push({
      id: "wind-severe",
      level: "severe",
      icon: "🌬️",
      title: "Damaging winds",
      detail: `Sustained ${Math.round(current.wind_speed_10m)} km/h. Secure loose objects and avoid travel if possible.`,
    });
  } else if (current.wind_speed_10m >= 40) {
    out.push({
      id: "wind",
      level: "warn",
      icon: "💨",
      title: "Strong winds",
      detail: `Around ${Math.round(current.wind_speed_10m)} km/h — driving high-profile vehicles may be tricky.`,
    });
  }

  // Very high UV
  const uv = current.uv_index ?? 0;
  if (uv >= 8 && current.is_day === 1) {
    out.push({
      id: "uv",
      level: "warn",
      icon: "🌞",
      title: "Very high UV",
      detail: `UV index ${Math.round(uv)}. Sunscreen, hat, and shade between 11am–4pm.`,
    });
  }

  // Heavy rain in the next 6h
  const next6Pop = hourly ? Math.max(...(hourly.precipitation_probability?.slice(0, 6) ?? [0])) : 0;
  if (kind === "rain" && next6Pop >= 80) {
    out.push({
      id: "rain",
      level: "warn",
      icon: "🌧️",
      title: "Heavy rain likely",
      detail: `${next6Pop}% chance in the next hours — watch for surface flooding.`,
    });
  }

  // Snow storm
  if (kind === "snow" && (daily?.precipitation_probability_max?.[0] ?? 0) >= 70) {
    out.push({
      id: "snow",
      level: "warn",
      icon: "🌨️",
      title: "Snowfall expected",
      detail: "Plan for slow travel and grippy shoes.",
    });
  }

  // Fog
  if (kind === "fog") {
    out.push({
      id: "fog",
      level: "info",
      icon: "🌫️",
      title: "Reduced visibility",
      detail: "Fog around — drive with low-beam headlights and extra distance.",
    });
  }

  return out;
}

/* ---------- Debounce ---------- */
function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}


/* ---------- App ---------- */
function Index() {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [unit, setUnit] = useState<"C" | "F">("C");
  const [current, setCurrent] = useState<Current | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [hourly, setHourly] = useState<Hourly | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Favorites (persisted to localStorage)
  const [favorites, setFavorites] = useState<Place[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("petrichor:favorites");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);
  const saveFavorites = (list: Place[]) => {
    setFavorites(list);
    try {
      localStorage.setItem("petrichor:favorites", JSON.stringify(list));
    } catch {}
  };
  const placeKey = (p: Place) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;
  const isFavorite =
    !!place && favorites.some((f) => placeKey(f) === placeKey(place));
  const toggleFavorite = () => {
    if (!place) return;
    const key = placeKey(place);
    if (favorites.some((f) => placeKey(f) === key)) {
      saveFavorites(favorites.filter((f) => placeKey(f) !== key));
    } else {
      saveFavorites([...favorites, place]);
    }
  };
  const removeFavorite = (p: Place) => {
    const key = placeKey(p);
    saveFavorites(favorites.filter((f) => placeKey(f) !== key));
  };


  // Autocomplete
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ac = new AbortController();
    fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
      { signal: ac.signal },
    )
      .then((r) => r.json())
      .then((j) => {
        const results: Place[] = (j?.results ?? []).map((r: any) => ({
          name: r.name,
          country: r.country ?? "",
          country_code: r.country_code,
          admin1: r.admin1,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone,
        }));
        setSuggestions(results);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [debounced]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const loadPlace = async (p: Place) => {
    setPlace(p);
    setShowSug(false);
    setQuery("");
    setLoading(true);
    setError(null);
    try {
      const tempUnit = unit === "C" ? "celsius" : "fahrenheit";
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,precipitation,uv_index` +
        `&hourly=temperature_2m,weather_code,precipitation_probability,uv_index` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max` +
        `&temperature_unit=${tempUnit}&wind_speed_unit=kmh&timezone=auto&forecast_days=7`;
      const r = await fetch(url);
      const j = await r.json();
      setCurrent(j.current);
      setDaily(j.daily);
      setHourly(j.hourly);
    } catch {
      setError("Couldn't load the forecast. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&language=en&format=json`,
          );
          const j = await r.json();
          const hit = j?.results?.[0];
          await loadPlace({
            name: hit?.name ?? "My Location",
            country: hit?.country ?? "",
            country_code: hit?.country_code,
            admin1: hit?.admin1,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        } catch {
          await loadPlace({
            name: "My Location",
            country: "",
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      },
      () => {
        setError("Location permission denied.");
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    if (!place) {
      loadPlace({
        name: "Paris",
        country: "France",
        country_code: "FR",
        admin1: "Île-de-France",
        latitude: 48.8566,
        longitude: 2.3522,
      });
    } else {
      loadPlace(place);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const tz = place?.timezone || undefined;
  const localTime = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const localDate = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });

  const kind = current ? desc(current.weather_code).kind : "clear";
  const isDay = current?.is_day === 1;

  const tips = useMemo(
    () => (current ? buildTips(current, hourly, daily, unit) : []),
    [current, hourly, daily, unit],
  );
  const advisories = useMemo(
    () => (current ? buildAdvisories(current, hourly, daily, unit) : []),
    [current, hourly, daily, unit],
  );

  const feelC = current
    ? unit === "C"
      ? current.apparent_temperature
      : ((current.apparent_temperature - 32) * 5) / 9
    : 0;
  const outfit = current ? outfitFor(feelC, kind) : null;
  const vibe = current ? vibeFor(kind, feelC, !!isDay) : "";
  const activity = current ? activityFor(kind, feelC) : null;

  // Next 12h precipitation for the mini radar
  const nowMs = Date.now();
  const rainBars =
    hourly?.time
      .map((t, i) => ({ t, pop: hourly.precipitation_probability?.[i] ?? 0 }))
      .filter((h) => new Date(h.t + "Z").getTime() >= nowMs - 60 * 60 * 1000)
      .slice(0, 12) ?? [];

  // Hourly strip
  const hourItems =
    hourly?.time
      .map((t, i) => ({
        t,
        temp: hourly.temperature_2m[i],
        code: hourly.weather_code[i],
        pop: hourly.precipitation_probability?.[i] ?? 0,
      }))
      .filter((h) => new Date(h.t + "Z").getTime() >= nowMs - 60 * 60 * 1000)
      .slice(0, 24) ?? [];

  const locationLine = place ? [place.admin1, place.country].filter(Boolean).join(", ") : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-blush text-ink">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-rose opacity-40 blur-3xl" />
        <div className="absolute top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-petal opacity-50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-berry opacity-25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-soft ring-1 ring-rose/30">
              🌦️
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black tracking-tight text-berry sm:text-2xl">
                Petrichor
              </h1>
              <p className="truncate text-[11px] text-ink/60">weather with a personality</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/80 p-1 shadow-soft ring-1 ring-rose/30 backdrop-blur">
            {(["C", "F"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`h-8 w-10 rounded-full text-sm font-semibold transition ${
                  unit === u ? "bg-berry text-white shadow-soft" : "text-berry/70 hover:text-berry"
                }`}
              >
                °{u}
              </button>
            ))}
          </div>
        </header>

        {/* Search */}
        <div ref={searchBoxRef} className="relative mt-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 shadow-soft ring-1 ring-rose/30 backdrop-blur focus-within:ring-2 focus-within:ring-berry/40">
              <span className="text-lg">🔎</span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSug(true);
                }}
                onFocus={() => setShowSug(true)}
                placeholder="Search a city — Tokyo, Nairobi, Buenos Aires…"
                className="w-full bg-transparent text-base text-ink placeholder-ink/50 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded-full px-2 text-ink/50 hover:text-ink"
                  aria-label="Clear"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="rounded-2xl bg-berry px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-berry/90"
            >
              📍 My location
            </button>
          </div>

          {showSug && suggestions.length > 0 && (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-white/95 shadow-soft ring-1 ring-rose/30 backdrop-blur">
              {suggestions.map((s, i) => (
                <li key={`${s.latitude}-${s.longitude}-${i}`}>
                  <button
                    onClick={() => loadPlace(s)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-petal/60"
                  >
                    <span className="text-xl">
                      {s.country_code ? flagEmoji(s.country_code) : "📍"}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{s.name}</div>
                      <div className="truncate text-xs text-ink/60">
                        {[s.admin1, s.country].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Favorites row */}
        {favorites.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {favorites.map((f) => {
              const active = place && placeKey(f) === placeKey(place);
              return (
                <div
                  key={placeKey(f)}
                  className={`group flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-sm shadow-soft ring-1 transition ${
                    active
                      ? "bg-berry text-white ring-berry"
                      : "bg-white/80 text-ink ring-rose/30 hover:bg-white"
                  }`}
                >
                  <button
                    onClick={() => loadPlace(f)}
                    className="flex items-center gap-1.5"
                  >
                    <span>{f.country_code ? flagEmoji(f.country_code) : "📍"}</span>
                    <span className="max-w-[10rem] truncate font-semibold">{f.name}</span>
                  </button>
                  <button
                    onClick={() => removeFavorite(f)}
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs transition ${
                      active ? "hover:bg-white/20" : "text-ink/40 hover:bg-petal/70 hover:text-ink"
                    }`}
                    aria-label={`Remove ${f.name}`}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl bg-berry/10 px-4 py-3 text-sm text-berry ring-1 ring-berry/20">
            {error}
          </div>
        )}

        {/* Advisories */}
        {advisories.length > 0 && (
          <section className="mt-6 space-y-2">
            {advisories.map((a) => {
              const styles =
                a.level === "severe"
                  ? "bg-berry text-white ring-berry"
                  : a.level === "warn"
                    ? "bg-rose/70 text-ink ring-rose"
                    : "bg-white/85 text-ink ring-rose/30";
              return (
                <div
                  key={a.id}
                  className={`flex items-start gap-3 rounded-2xl px-4 py-3 shadow-soft ring-1 ${styles}`}
                  role="alert"
                >
                  <span className="text-2xl leading-none">{a.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                        {a.level === "severe" ? "Severe" : a.level === "warn" ? "Advisory" : "Notice"}
                      </span>
                      <h4 className="truncate text-sm font-bold">{a.title}</h4>
                    </div>
                    <p className="mt-0.5 text-sm opacity-90">{a.detail}</p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Hero: animated scene + temperature */}
        <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-rose via-petal to-white p-6 shadow-soft ring-1 ring-rose/30 sm:p-8">
          <WeatherScene kind={kind} isDay={!!isDay} />
          {loading && !current ? (
            <div className="animate-pulse py-16 text-center text-ink/50">Reading the sky…</div>
          ) : current && place ? (
            <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-ink/60">
                  <span>{place.country_code ? flagEmoji(place.country_code) : "📍"}</span>
                  <span className="truncate">{locationLine || "—"}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="truncate text-3xl font-black text-berry sm:text-4xl">
                    {place.name}
                  </h2>
                  <button
                    onClick={toggleFavorite}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg shadow-soft ring-1 transition ${
                      isFavorite
                        ? "bg-berry text-white ring-berry"
                        : "bg-white/70 text-ink/60 ring-rose/30 hover:text-berry"
                    }`}
                    aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                    title={isFavorite ? "Saved" : "Save location"}
                  >
                    {isFavorite ? "★" : "☆"}
                  </button>
                </div>
                <div className="mt-1 text-xs text-ink/60">
                  {localDate} · {localTime}
                </div>
                <div className="mt-5 flex items-end gap-3">
                  <div className="text-7xl font-black leading-none text-berry sm:text-8xl">
                    {Math.round(current.temperature_2m)}°
                  </div>
                  <div className="mb-2">
                    <div className="text-lg font-semibold text-ink">
                      {desc(current.weather_code).label}
                    </div>
                    <div className="text-sm text-ink/60">
                      Feels like {Math.round(current.apparent_temperature)}°
                    </div>
                  </div>
                </div>
                <p className="mt-4 max-w-md rounded-2xl bg-white/60 px-4 py-2 text-sm italic text-ink/80 ring-1 ring-rose/20">
                  “{vibe}”
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:w-64">
                <Stat label="Humidity" value={`${current.relative_humidity_2m}%`} icon="💧" />
                <Stat
                  label="Wind"
                  value={`${Math.round(current.wind_speed_10m)} km/h ${compass(current.wind_direction_10m)}`}
                  icon="💨"
                />
                <Stat
                  label="High / Low"
                  value={
                    daily
                      ? `${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°`
                      : "—"
                  }
                  icon="🌡️"
                />
                <Stat
                  label="UV"
                  value={current.uv_index != null ? `${Math.round(current.uv_index)}` : "—"}
                  icon="🌞"
                />
              </div>
            </div>
          ) : null}
        </section>

        {/* Personality panel: tips + outfit + activity */}
        {current && outfit && activity && (
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white/85 p-5 shadow-soft ring-1 ring-rose/30 md:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-berry/70">
                What you should do
              </h3>
              <ul className="mt-3 space-y-2">
                {tips.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-2xl bg-petal/50 px-3 py-2 ring-1 ring-rose/20"
                  >
                    <span className="text-2xl leading-none">{t.icon}</span>
                    <span className="text-sm text-ink">{t.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4">
              <div className="rounded-3xl bg-white/85 p-5 shadow-soft ring-1 ring-rose/30">
                <h3 className="text-xs font-bold uppercase tracking-widest text-berry/70">
                  Wear this
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-3xl">{outfit.icon}</span>
                  <span className="font-semibold text-ink">{outfit.label}</span>
                </div>
              </div>
              <div className="rounded-3xl bg-white/85 p-5 shadow-soft ring-1 ring-rose/30">
                <h3 className="text-xs font-bold uppercase tracking-widest text-berry/70">
                  Do this
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-3xl">{activity.icon}</span>
                  <span className="font-semibold text-ink">{activity.label}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Rain radar (next 12h) */}
        {rainBars.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white/85 p-5 shadow-soft ring-1 ring-rose/30">
            <div className="flex items-baseline justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-berry/70">
                Rain outlook · next 12h
              </h3>
              <span className="text-xs text-ink/60">
                peak {Math.max(...rainBars.map((b) => b.pop))}%
              </span>
            </div>
            <div className="mt-3 flex items-end gap-1.5">
              {rainBars.map((b, i) => (
                <div key={b.t} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-rose to-berry transition-all"
                      style={{ height: `${Math.max(4, b.pop)}%` }}
                      title={`${b.pop}%`}
                    />
                  </div>
                  <div className="text-[10px] text-ink/60">
                    {i === 0
                      ? "now"
                      : new Date(b.t + "Z").toLocaleTimeString([], {
                          hour: "numeric",
                          timeZone: tz,
                        })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Hourly */}
        {hourItems.length > 0 && (
          <section className="mt-6 rounded-3xl bg-white/85 p-4 shadow-soft ring-1 ring-rose/30 sm:p-6">
            <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-berry/70">
              Next 24 hours
            </h3>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {hourItems.map((h, i) => {
                const d = new Date(h.t + "Z");
                const label =
                  i === 0
                    ? "Now"
                    : d.toLocaleTimeString([], { hour: "numeric", timeZone: tz });
                return (
                  <div
                    key={h.t}
                    className="flex min-w-16 flex-col items-center gap-1 rounded-2xl bg-petal/60 px-3 py-3 text-sm ring-1 ring-rose/20"
                  >
                    <div className="text-xs font-medium text-ink/60">{label}</div>
                    <div className="text-2xl">{desc(h.code).icon}</div>
                    <div className="font-bold text-berry">{Math.round(h.temp)}°</div>
                    <div className="text-[10px] text-ink/60">💧 {h.pop}%</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Daily */}
        {daily && (
          <section className="mt-6 rounded-3xl bg-white/85 p-4 shadow-soft ring-1 ring-rose/30 sm:p-6">
            <h3 className="px-2 text-xs font-bold uppercase tracking-widest text-berry/70">
              7-day forecast
            </h3>
            <ul className="mt-3 divide-y divide-rose/20">
              {daily.time.map((t, i) => {
                const d = new Date(t + "T12:00:00");
                const dayLabel = i === 0 ? "Today" : d.toLocaleDateString([], { weekday: "long" });
                const min = daily.temperature_2m_min[i];
                const max = daily.temperature_2m_max[i];
                const pop = daily.precipitation_probability_max?.[i] ?? 0;
                const weekMin = Math.min(...daily.temperature_2m_min);
                const weekMax = Math.max(...daily.temperature_2m_max);
                const span = Math.max(1, weekMax - weekMin);
                const left = ((min - weekMin) / span) * 100;
                const right = ((max - weekMin) / span) * 100;
                return (
                  <li
                    key={t}
                    className="grid grid-cols-[5rem_auto_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[7rem_auto_1fr_auto] sm:gap-4"
                  >
                    <div className="truncate font-semibold text-ink">{dayLabel}</div>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-xl">{desc(daily.weather_code[i]).icon}</span>
                      <span className="hidden text-xs text-ink/60 sm:inline">💧{pop}%</span>
                    </div>
                    <div className="relative h-2 min-w-16 rounded-full bg-petal/70">
                      <div
                        className="absolute top-0 h-2 rounded-full bg-gradient-to-r from-rose to-berry"
                        style={{ left: `${left}%`, width: `${Math.max(4, right - left)}%` }}
                      />
                    </div>
                    <div className="tabular-nums text-right text-sm">
                      <span className="text-ink/50">{Math.round(min)}°</span>
                      <span className="mx-1 text-ink/30">·</span>
                      <span className="font-bold text-berry">{Math.round(max)}°</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="mt-8 pb-4 text-center text-xs text-ink/50">
          Petrichor · data by Open-Meteo · made to be enjoyed 🌸
        </footer>
      </div>
    </div>
  );
}

/* ---------- Small subcomponents ---------- */
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-rose/30">
      <div className="text-xs text-ink/60">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate text-base font-bold text-berry">{value}</div>
    </div>
  );
}

function flagEmoji(code: string) {
  if (!code || code.length !== 2) return "📍";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/* ---------- Animated CSS-only weather scene ---------- */
function WeatherScene({ kind, isDay }: { kind: Kind; isDay: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
    >
      {/* Sun / Moon */}
      {(kind === "clear" || kind === "cloudy") && (
        <div className="absolute -right-8 -top-8 h-40 w-40">
          <div
            className={`absolute inset-4 rounded-full ${
              isDay ? "bg-yellow-300/80" : "bg-slate-200/80"
            } blur-xl`}
          />
          <div
            className={`absolute inset-8 rounded-full ${
              isDay ? "bg-yellow-200" : "bg-slate-100"
            } shadow-[0_0_60px_rgba(255,220,150,0.7)]`}
          />
          {isDay && (
            <div className="absolute inset-0 animate-[spin_18s_linear_infinite]">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2 h-16 w-0.5 -translate-x-1/2 -translate-y-1/2 origin-center bg-yellow-200/60"
                  style={{ transform: `translate(-50%,-50%) rotate(${i * 30}deg)` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clouds */}
      {(kind === "cloudy" || kind === "rain" || kind === "storm" || kind === "snow") && (
        <>
          <div className="absolute left-4 top-6 h-10 w-24 rounded-full bg-white/70 blur-[2px] animate-[drift_22s_linear_infinite]" />
          <div className="absolute left-24 top-16 h-8 w-20 rounded-full bg-white/60 blur-[2px] animate-[drift_28s_linear_infinite]" />
          <div className="absolute right-24 top-10 h-12 w-28 rounded-full bg-white/70 blur-[2px] animate-[drift_25s_linear_infinite]" />
        </>
      )}

      {/* Rain */}
      {(kind === "rain" || kind === "storm") && (
        <div className="absolute inset-0">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 h-6 w-0.5 rounded bg-berry/40 animate-[rain_1s_linear_infinite]"
              style={{
                left: `${(i * 4.3) % 100}%`,
                animationDelay: `${(i % 10) * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Snow */}
      {kind === "snow" && (
        <div className="absolute inset-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 text-white/90 animate-[snow_5s_linear_infinite]"
              style={{
                left: `${(i * 5) % 100}%`,
                animationDelay: `${(i % 8) * 0.4}s`,
                fontSize: `${8 + (i % 4) * 2}px`,
              }}
            >
              ❄
            </span>
          ))}
        </div>
      )}

      {/* Fog */}
      {kind === "fog" && (
        <>
          <div className="absolute inset-x-0 top-8 h-8 bg-white/40 blur-md animate-[drift_20s_linear_infinite]" />
          <div className="absolute inset-x-0 top-24 h-6 bg-white/30 blur-md animate-[drift_28s_linear_infinite]" />
        </>
      )}

      {/* Storm flashes */}
      {kind === "storm" && (
        <div className="absolute inset-0 animate-[flash_5s_ease-in-out_infinite] bg-white/0 mix-blend-overlay" />
      )}
    </div>
  );
}
