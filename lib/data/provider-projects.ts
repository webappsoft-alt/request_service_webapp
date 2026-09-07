import { slugifyJob } from "@/lib/data/jobs";
import { getAreaName } from "@/lib/data/service-areas";
import { getProviderPhotos } from "@/lib/data/provider-media";
import { getAllProviders } from "@/lib/data/providers";
import { getServiceCategoryById } from "@/lib/data/services";
import { formatLocation } from "@/lib/format";
import type { Provider, ProviderProject } from "@/lib/types";

const projectCopy: Record<string, { summary: string; details: string[] }> = {
  "Kitchen plumbing fixture replacement": {
    summary: "Swapped tired kitchen fittings and checked the supply lines before the finish work.",
    details: [
      "The homeowner sent photos of leaking handles and a worn spray head. The visit confirmed the valves and supply lines needed to come out with the fixtures.",
      "Labor, fittings, and shutoff valves were written as separate lines so the signed total matched what was installed.",
      "After the swap, the team pressure-tested the new connections and left the cabinet dry and wiped down.",
    ],
  },
  "Water heater installation": {
    summary: "Replaced an aging tank and set the new unit to the approved spec.",
    details: [
      "The original estimate covered the unit, drain pan, and disconnect. A same-day photo confirmed the closet clearance before delivery.",
      "The old tank was hauled out, the new heater was set, and the T&P line was routed to the approved drain.",
      "Startup temperatures and the warranty card stayed on the job file with the signed estimate.",
    ],
  },
  "HVAC seasonal maintenance": {
    summary: "Cleaned, tested, and documented a seasonal tune-up before the heat arrived.",
    details: [
      "The request listed weak airflow and a filter that had been left too long. The visit covered coils, condensate, and a full performance check.",
      "Findings were written against the original maintenance scope so extra parts would have been a change order, not a quiet add.",
      "The homeowner kept a one-page report of readings and the next recommended service window.",
    ],
  },
  "Completed bathroom supply line repair": {
    summary: "Stopped a vanity leak and replaced the failed supply line without opening the wall.",
    details: [
      "Photos showed staining under the sink. On site, the braided line had failed at the crimp, not the valve.",
      "The repair stayed inside the approved line items: shutoff, supply line, and a wipe-down of the cabinet floor.",
      "The original estimate stayed on file in case the angle stop needed a later swap.",
    ],
  },
  "Panel upgrade": {
    summary: "Brought a crowded service panel up to the load the house actually uses.",
    details: [
      "The estimate listed the panel, permit, and labor as separate lines. Photos of the existing can went out with the request.",
      "The crew isolated circuits, landed the new panel, and labeled every breaker before energizing.",
      "Inspection notes and the signed scope stayed together so the homeowner could show the work later.",
    ],
  },
  "Kitchen lighting install": {
    summary: "Added recessed kitchen lighting on the existing circuit without a ceiling tear-out.",
    details: [
      "The homeowner marked can locations on a photo. The visit confirmed joist bays and the switch location.",
      "Cans, trims, and dimmer were itemized. Cutouts were patched and wiped before the walkthrough.",
      "The signed lighting count stayed on the job so a later island pendant would be a new request.",
    ],
  },
  "EV charger preparation": {
    summary: "Ran a dedicated circuit and left the bay ready for the charger the owner already bought.",
    details: [
      "The request included the charger model and a photo of the panel. The estimate covered the homerun, breaker, and box only.",
      "The crew pulled the circuit, landed the breaker, and labeled the disconnect for the installer.",
      "No charger mount was added on site. That would have been a change order against the original prep scope.",
    ],
  },
  "Safety inspection report": {
    summary: "Walked the house and wrote a clear list of electrical items that needed attention.",
    details: [
      "The visit covered receptacles, GFCI, smoke-detector power, and the panel directory.",
      "Each finding was listed with a recommended next step so the homeowner could request only the work they wanted.",
      "The report stayed attached to the company profile so a later repair could start from the same list.",
    ],
  },
  "Living room interior paint": {
    summary: "Rolled walls, cut trim, and left the room ready the same afternoon.",
    details: [
      "The estimate named rooms, coats, and whether furniture would be moved. Photos showed the current color.",
      "The crew protected floors, cut edges, and rolled two coats to the approved color.",
      "Touch-up paint and the original room list stayed with the signed estimate.",
    ],
  },
  "Exterior trim": {
    summary: "Scraped failed paint on exterior trim and recut the edges for a clean line.",
    details: [
      "The request photos showed peeling on the window casings. The visit confirmed how much wood needed primer.",
      "Prep, primer, and finish coats were separate lines so weather delays would not rewrite the price.",
      "The finished trim was photographed against the original elevation so the homeowner had a before and after.",
    ],
  },
  "Cabinet refinishing": {
    summary: "Stripped worn cabinet faces and sprayed a durable finish in place.",
    details: [
      "Doors were labeled, hardware bagged, and the kitchen stayed usable at the end of each day.",
      "The estimate listed degrease, sand, and spray as the scope. New hardware was not included.",
      "The color sample the homeowner signed stayed on the job file.",
    ],
  },
  "Stairwell finish": {
    summary: "Cut a tall stairwell without leaving roller marks on the high wall.",
    details: [
      "Access and drop cloths were part of the written scope because the stairwell is the main path through the house.",
      "The crew used a pole system and a second coat only where the first coat flashed.",
      "The walkthrough happened in daylight so the homeowner could see the cut lines before sign-off.",
    ],
  },
  "Shingle replacement": {
    summary: "Stripped a worn slope and laid a new shingle field to the approved spec.",
    details: [
      "The estimate listed tear-off, underlayment, shingles, and ridge. Photos of the existing field went with the request.",
      "Soft decking, if found, would have been a change order. This roof did not need it.",
      "The crew magnet-swept the yard and left the signed material list with the homeowner.",
    ],
  },
  "Leak repair": {
    summary: "Found the wet spot, opened only what was needed, and closed the roof the same day.",
    details: [
      "The request photo showed a stain at the ceiling. On the roof, a lifted shingle and a dry nail line were the cause.",
      "Repair stayed inside the leak-scope line items. A full replacement was quoted separately and not started.",
      "Interior stain treatment was left off this visit so the drywall could settle before paint.",
    ],
  },
  "Inspection photos": {
    summary: "Documented the roof condition with labeled photos the homeowner could keep.",
    details: [
      "The visit covered field, flashings, valleys, and penetrations. Each photo was tagged to a note.",
      "The report listed what could wait and what should be priced as a repair.",
      "Those photos became the starting file if the homeowner later requested replacement.",
    ],
  },
  "Completed ridge line": {
    summary: "Reset a tired ridge and sealed the caps so the peak shed water again.",
    details: [
      "The original estimate named ridge cap, nails, and sealant only. Field shingles were not in scope.",
      "The crew pulled the failed caps, checked the ridge vent, and set the new line straight.",
      "A close-up of the finished ridge stayed with the signed job.",
    ],
  },
  "Kitchen after service": {
    summary: "Reset the kitchen after a deep clean so the counters and floors were ready that night.",
    details: [
      "The checklist covered counters, appliances, and the floor. Photos from the request set the before state.",
      "Products and time were written as a package so extra oven-only work would have been a change.",
      "The crew walked the kitchen with the homeowner before leaving.",
    ],
  },
  "Bathroom detail": {
    summary: "Detailed a bathroom to the signed checklist, including grout lines and glass.",
    details: [
      "The request listed soap film on glass and staining at the grout. Those items were on the estimate.",
      "The team worked top to bottom and left the floor dry.",
      "A follow-up photo of the glass stayed on the job file.",
    ],
  },
  "Living area reset": {
    summary: "Cleared, dusted, and reset a living room after a weekly service.",
    details: [
      "Furniture stay-put notes from the homeowner were on the ticket so nothing was rearranged.",
      "Floors, surfaces, and the main traffic paths were on the signed list.",
      "The room was photographed from the same angle as the request.",
    ],
  },
  "Move-out clean": {
    summary: "Emptied a unit to a move-out checklist the landlord could walk without a punch list.",
    details: [
      "The estimate used the property's move-out list: appliances, baths, floors, and insides of cabinets.",
      "The crew worked room by room and noted anything that was not in scope, such as paint.",
      "The signed checklist went back with the photos.",
    ],
  },
  "TV mounting": {
    summary: "Centered the set, found the studs, and hid the cords without opening the whole wall.",
    details: [
      "The homeowner sent the TV size and a photo of the wall. The visit confirmed stud layout and the outlet location.",
      "Mount, lag bolts, and cord management were on the estimate. A new outlet was not.",
      "The set was leveled, the cords were dressed, and the remote was tested before the crew left.",
    ],
  },
  "Vanity hardware": {
    summary: "Replaced worn vanity pulls and tightened the doors so they closed square.",
    details: [
      "The request listed loose knobs and a door that rubbed. Hardware was supplied by the homeowner.",
      "The crew aligned the doors, set the new pulls, and checked the drawer slides.",
      "Painting the vanity was not in this scope and was left as a later request.",
    ],
  },
  "Door adjustment": {
    summary: "Reset a sticking interior door so it latched without being forced.",
    details: [
      "Photos showed the latch missing the plate. On site, the hinge side had settled.",
      "Hinges were tightened and the strike was moved just enough to catch cleanly.",
      "A full door replacement was quoted only as an option and was not started.",
    ],
  },
  "Punch-list repairs": {
    summary: "Closed a short list of small items in one visit so the house felt finished.",
    details: [
      "The homeowner attached a punch list with photos. Each item was priced as a line so nothing was guessed on site.",
      "The crew worked the list in order: hardware, caulk, and a few loose trim pieces.",
      "Items that needed parts not on the truck were written as a follow-up instead of a surprise charge.",
    ],
  },
  "Front yard maintenance": {
    summary: "Cut, edged, and blown a front yard to the weekly property scope.",
    details: [
      "The estimate defined the lot, beds to stay out of, and whether clippings were bagged.",
      "The crew mowed, edged the walk, and cleared the driveway.",
      "A seasonal extra such as a shrub cut would have been a change order.",
    ],
  },
  "Seasonal cleanup": {
    summary: "Cleared leaf load and spent beds so the yard was ready for the next season.",
    details: [
      "The request photos showed leaf piles against the fence. The visit confirmed how much would be hauled.",
      "Haul-away and bed raking were on the signed list. New planting was not.",
      "The crew left the walks blown and the beds edged.",
    ],
  },
  "Planting bed": {
    summary: "Reset a tired bed with the plants named on the estimate.",
    details: [
      "The homeowner picked the plant list before the visit. Soil and mulch were separate lines.",
      "The crew pulled spent material, set the new plants, and watered in.",
      "Irrigation changes were left off this job and noted for a later request.",
    ],
  },
  "Irrigation check": {
    summary: "Walked the zones, flagged broken heads, and wrote what needed parts.",
    details: [
      "The visit ran each zone and marked heads that misted or missed the lawn.",
      "Repair parts were listed against the check so the homeowner could approve only those heads.",
      "A full redesign was not started from this visit.",
    ],
  },
  "Inspection visit": {
    summary: "Walked the property and wrote a pest inspection the homeowner could keep.",
    details: [
      "The technician checked interior, exterior, and common entry points. Findings were photographed.",
      "Treatment was not assumed. The report listed what should be priced next.",
      "The signed inspection stayed on the company file for the follow-up visit.",
    ],
  },
  "Exterior treatment": {
    summary: "Treated the exterior to the product and perimeter named on the estimate.",
    details: [
      "The request listed activity along the foundation. The visit confirmed the treatable perimeter.",
      "Product, mix, and areas were on the ticket so the homeowner knew what was applied.",
      "Interior rooms were not treated on this trip.",
    ],
  },
  "Exclusion work": {
    summary: "Closed the gaps that were letting pests back in after treatment.",
    details: [
      "The inspection photos marked weep holes, a door sweep, and a utility penetration.",
      "Each exclusion item was a line on the estimate. Foam and mesh were included.",
      "A later attic visit would be a new request, not an add-on on the truck.",
    ],
  },
  "Follow-up checklist": {
    summary: "Came back on the scheduled window and confirmed the first treatment held.",
    details: [
      "The follow-up used the original findings list. New activity would have been written as a new item.",
      "The technician checked the treated zones and the exclusion points.",
      "The homeowner kept the same job file from inspection through follow-up.",
    ],
  },
};

const completedDates = ["2026-05-12", "2026-04-03", "2026-03-18", "2026-02-21", "2026-01-09", "2025-11-14"];

function fallbackTitles(provider: Provider) {
  return provider.categoryIds
    .flatMap((id) => getServiceCategoryById(id)?.commonServices ?? [])
    .slice(0, 4);
}

function projectImages(provider: Provider, index: number) {
  const photos = getProviderPhotos(provider).map((item) => item.src);
  if (!photos.length) return ["/images/home/hero-home.jpg"];
  const rotated = [...photos.slice(index), ...photos.slice(0, index)];
  return rotated.slice(0, 4);
}

function copyFor(title: string, provider: Provider, categoryName: string) {
  const known = projectCopy[title];
  if (known) return known;
  return {
    summary: `${title} completed in ${provider.city} with a written scope before the visit.`,
    details: [
      `${provider.companyName} scoped this ${categoryName.toLowerCase()} job from the request photos before anyone was scheduled.`,
      "Labor and materials stayed on the signed estimate. Extra work would have been a change order.",
      `The finished job was photographed in ${formatLocation(provider.city, provider.state)} and kept on the company file.`,
    ],
  };
}

export function getProviderProjects(provider: Provider): ProviderProject[] {
  const titles = (provider.gallery.length ? provider.gallery : fallbackTitles(provider)).slice(0, 4);
  return titles.map((title, index) => {
    const categoryId = provider.categoryIds[index % provider.categoryIds.length] ?? "";
    const categoryName = getServiceCategoryById(categoryId)?.name ?? "Home service";
    const images = projectImages(provider, index);
    const zip = provider.serviceArea[index % provider.serviceArea.length] ?? provider.zip;
    const copy = copyFor(title, provider, categoryName);
    return {
      slug: slugifyJob(title),
      title,
      summary: copy.summary,
      location: `${getAreaName(zip)}, ${provider.city}`,
      completedOn: completedDates[index % completedDates.length],
      categoryName,
      cover: images[0],
      images,
      details: copy.details,
    };
  });
}

export function getProviderProject(provider: Provider, slug: string) {
  return getProviderProjects(provider).find((item) => item.slug === slug);
}

export function getRelatedProviderProjects(provider: Provider, slug: string, limit = 3) {
  return getProviderProjects(provider)
    .filter((item) => item.slug !== slug)
    .slice(0, limit);
}

export function getAllProviderProjectParams() {
  return getAllProviders().flatMap((provider) =>
    getProviderProjects(provider).map((project) => ({
      slug: provider.slug,
      project: project.slug,
    }))
  );
}
