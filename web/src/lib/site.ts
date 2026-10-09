/** Absolute origin for metadata (Open Graph URLs). Vercel sets the production host at build time. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const SITE = {
  name: "Self-Driving DB Lab",
  short: "SDDB Lab",
  description:
    "Five index advisors from 1985 to 2023 compete on a live SQLite database in your browser — an interactive revival of the COMP90050 Group 40 survey on self-driving databases.",
  repo: "https://github.com/rNLKJA/Unimelb-Master-2023-COMP90050",
  subject: "COMP90050 Advanced Database Systems",
  university: "The University of Melbourne",
  term: "2023 Winter term",
  group: "Group 40",
};

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/survey", label: "Survey map" },
  { href: "/arena", label: "Arena" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/forecast", label: "Forecasting" },
  { href: "/console", label: "SQL console" },
  { href: "/methods", label: "Methods" },
  { href: "/about", label: "About" },
] as const;

/** Rin's undergraduate database-design project, the first stop of the database journey. */
export const INFO20003 = {
  site: "https://info20003-louvre-ops-db.vercel.app",
  erd: "https://info20003-louvre-ops-db.vercel.app/schema",
  subject: "INFO20003 Database Systems",
  term: "2020 Semester 1",
};
