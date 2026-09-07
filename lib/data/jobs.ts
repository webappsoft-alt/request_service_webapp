import { getServiceCategoryBySlug, serviceCategories } from "@/lib/data/services";
import type { ServiceCategory } from "@/lib/types";
import {
  Bath,
  Bug,
  Cable,
  DoorOpen,
  Droplets,
  Fan,
  Flower2,
  Hammer,
  Heater,
  House,
  Leaf,
  Lightbulb,
  PaintRoller,
  Plug,
  Rat,
  Search,
  Shield,
  ShowerHead,
  Sofa,
  Sparkles,
  SprayCan,
  Square,
  Sun,
  Thermometer,
  Trees,
  Tv,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const jobDetails: Record<
  string,
  { description: string; points: string[]; icon: LucideIcon }
> = {
  "Leak detection and repair": {
    description: "Find the leak, stop the water, and repair the damaged line or fixture.",
    points: ["Find the leak", "Stop the water", "Repair the line"],
    icon: Droplets,
  },
  "Water heater installation": {
    description: "Replace a failed unit and leave you with a working, documented install.",
    points: ["Remove the failed unit", "Install the new heater", "Document the work"],
    icon: Heater,
  },
  "Drain cleaning": {
    description: "Clear a slow or blocked drain so sinks, tubs, and stacks run again.",
    points: ["Clear the blockage", "Restore the flow", "Check sinks and stacks"],
    icon: Wrench,
  },
  "Fixture replacement": {
    description: "Swap a faucet, toilet, or supply line with the parts listed in the estimate.",
    points: ["Swap the fixture", "Reconnect supply lines", "Test for leaks"],
    icon: ShowerHead,
  },
  "AC repair and recharge": {
    description: "Diagnose a weak system, recharge when needed, and confirm it cools the house.",
    points: ["Diagnose the system", "Recharge if needed", "Confirm it cools"],
    icon: Thermometer,
  },
  "Furnace service": {
    description: "Service or repair the heater so it starts cleanly and holds temperature.",
    points: ["Service the heater", "Confirm a clean start", "Hold temperature"],
    icon: Heater,
  },
  "Seasonal maintenance": {
    description: "A scheduled tune-up before the season so the system is ready to run.",
    points: ["Scheduled tune-up", "Check key parts", "Ready for the season"],
    icon: Sun,
  },
  "Thermostat installation": {
    description: "Install and test a new thermostat so heating and cooling follow the set point.",
    points: ["Install the thermostat", "Wire it correctly", "Test the set point"],
    icon: Thermometer,
  },
  "Outlet and switch repair": {
    description: "Replace a dead outlet or switch and confirm the circuit is safe to use.",
    points: ["Replace the outlet or switch", "Test the circuit", "Leave it safe to use"],
    icon: Plug,
  },
  "Lighting installation": {
    description: "Hang or rewire fixtures and leave the room on a working switch.",
    points: ["Hang or rewire the fixture", "Connect the switch", "Test the room"],
    icon: Lightbulb,
  },
  "Panel upgrades": {
    description: "Upgrade the panel when the house needs more capacity or a safer service.",
    points: ["Assess capacity", "Upgrade the panel", "Safer service"],
    icon: Zap,
  },
  "EV charger preparation": {
    description: "Run the circuit and prep the bay so a charger can be installed to code.",
    points: ["Run the circuit", "Prep the bay", "Ready for a charger"],
    icon: Cable,
  },
  "Furniture assembly": {
    description: "Assemble furniture on site and leave it level, tight, and ready to use.",
    points: ["Assemble on site", "Level and tighten", "Ready to use"],
    icon: Sofa,
  },
  "TV and shelf mounting": {
    description: "Mount a TV or shelf into studs and hide the hardware you asked to hide.",
    points: ["Find the studs", "Mount the TV or shelf", "Hide the hardware"],
    icon: Tv,
  },
  "Door and trim repair": {
    description: "Fix a sticking door, loose trim, or damaged casing so it closes cleanly.",
    points: ["Fix the door or trim", "Tighten loose casing", "Close it cleanly"],
    icon: DoorOpen,
  },
  "Caulking and patching": {
    description: "Seal gaps and patch small holes so the finish is ready for paint.",
    points: ["Seal the gaps", "Patch small holes", "Ready for paint"],
    icon: Hammer,
  },
  "Recurring house cleaning": {
    description: "A regular clean on a published checklist for kitchens, baths, and floors.",
    points: ["Published checklist", "Kitchens and baths", "Floors included"],
    icon: SprayCan,
  },
  "Move-in and move-out cleans": {
    description: "A one-time deep clean before you move in or hand the keys back.",
    points: ["One-time deep clean", "Empty-home focus", "Ready for keys"],
    icon: House,
  },
  "Deep cleaning": {
    description: "A heavier clean for kitchens, baths, and build-up that weekly work misses.",
    points: ["Heavier clean", "Kitchens and baths", "Built-up areas"],
    icon: Sparkles,
  },
  "Kitchen and bath focus": {
    description: "Concentrate on sinks, tile, appliances, and high-touch surfaces.",
    points: ["Sinks and tile", "Appliances", "High-touch surfaces"],
    icon: ShowerHead,
  },
  "Roof inspections": {
    description: "Walk the roof, photograph the issue, and write up what needs repair.",
    points: ["Walk the roof", "Photograph the issue", "Write the repair list"],
    icon: Search,
  },
  "Leak repair": {
    description: "Stop an active roof leak and document the patch in the job file.",
    points: ["Stop the leak", "Patch the area", "Document the work"],
    icon: Droplets,
  },
  "Shingle replacement": {
    description: "Replace damaged shingles and flash the area so water stays out.",
    points: ["Replace damaged shingles", "Flash the area", "Keep water out"],
    icon: House,
  },
  "Storm damage assessment": {
    description: "Inspect after a storm and itemize what should be repaired or replaced.",
    points: ["Inspect after the storm", "Itemize the damage", "Repair or replace list"],
    icon: Shield,
  },
  "Lawn maintenance": {
    description: "Mow, edge, and tidy the yard on a set schedule.",
    points: ["Mow the lawn", "Edge the beds", "Tidy the yard"],
    icon: Leaf,
  },
  "Seasonal cleanup": {
    description: "Clear leaves, beds, and debris at the start or end of the season.",
    points: ["Clear leaves", "Clean the beds", "Haul the debris"],
    icon: Trees,
  },
  "Mulch and planting": {
    description: "Refresh beds with mulch and plants listed in the written scope.",
    points: ["Refresh the beds", "Add mulch", "Plant from the scope"],
    icon: Flower2,
  },
  "Shrub trimming": {
    description: "Cut back shrubs and shape hedges so they stay off the house and walk.",
    points: ["Cut back shrubs", "Shape hedges", "Clear the walk"],
    icon: Trees,
  },
  "Interior painting": {
    description: "Prep walls and paint rooms with the coats and color in the estimate.",
    points: ["Prep the walls", "Paint the rooms", "Approved color and coats"],
    icon: PaintRoller,
  },
  "Exterior painting": {
    description: "Prep siding and paint the exterior, including the trim you approved.",
    points: ["Prep the siding", "Paint the exterior", "Include approved trim"],
    icon: PaintRoller,
  },
  "Bathroom painting": {
    description: "Prep humid rooms and paint bathrooms with a finish that holds up to steam.",
    points: ["Prep humid rooms", "Prime and paint", "Moisture-ready finish"],
    icon: PaintRoller,
  },
  "Cabinet painting": {
    description: "Sand, prime, and paint cabinet faces for a durable finish.",
    points: ["Sand the faces", "Prime and paint", "Durable finish"],
    icon: Square,
  },
  "Drywall prep": {
    description: "Patch, sand, and prime so the wall is ready for a clean paint job.",
    points: ["Patch the wall", "Sand it smooth", "Prime for paint"],
    icon: Hammer,
  },
  "Vanity replacement": {
    description: "Swap the vanity, reconnect the plumbing, and leave the sink working.",
    points: ["Swap the vanity", "Reconnect plumbing", "Leave the sink working"],
    icon: Droplets,
  },
  "Tile and shower updates": {
    description: "Reset tile or refresh a shower surround with the materials in the scope.",
    points: ["Reset or refresh tile", "Update the surround", "Materials in the scope"],
    icon: ShowerHead,
  },
  "Fixture upgrades": {
    description: "Replace bath fixtures and confirm shutoffs, drains, and finishes.",
    points: ["Replace fixtures", "Check shutoffs and drains", "Match the finish"],
    icon: Wrench,
  },
  "Lighting and ventilation": {
    description: "Update bath lighting or the exhaust fan so the room vents and lights correctly.",
    points: ["Update the lighting", "Service the exhaust fan", "Vent and light correctly"],
    icon: Fan,
  },
  "General pest inspections": {
    description: "Inspect the house, name the pest, and write a treatment plan before any spray.",
    points: ["Inspect the house", "Name the pest", "Write a treatment plan"],
    icon: Search,
  },
  "Ant and roach treatment": {
    description: "Treat the infestation and note follow-up so it does not come back next week.",
    points: ["Treat the infestation", "Note the follow-up", "Help keep it from coming back"],
    icon: Bug,
  },
  "Rodent exclusion": {
    description: "Find entry points, seal them, and remove the nest if one is active.",
    points: ["Find entry points", "Seal them", "Remove an active nest"],
    icon: Rat,
  },
  "Termite inspections": {
    description: "Check wood and soil for termites and document what needs treatment.",
    points: ["Check wood and soil", "Look for termites", "Document treatment"],
    icon: Bug,
  },
  "Sewer line inspection": {
    description: "Camera the line, find the blockage or break, and write the repair options.",
    points: ["Camera the line", "Find the issue", "Write repair options"],
    icon: Search,
  },
  "Emergency shutoff support": {
    description: "Stop active water damage, shut the supply, and stabilize the line.",
    points: ["Shut the water", "Stop the damage", "Stabilize the line"],
    icon: Droplets,
  },
  "Toilet repair": {
    description: "Fix a running, leaking, or clogged toilet and leave it flushing cleanly.",
    points: ["Diagnose the toilet", "Replace worn parts", "Confirm a clean flush"],
    icon: Wrench,
  },
  "Faucet installation": {
    description: "Swap the faucet, reconnect the supplies, and test for a dry sink.",
    points: ["Remove the old faucet", "Set the new one", "Test for leaks"],
    icon: ShowerHead,
  },
  "Garbage disposal repair": {
    description: "Clear a jammed disposal or replace it so the sink drains again.",
    points: ["Clear the jam", "Repair or replace", "Restore the drain"],
    icon: Wrench,
  },
  "Duct inspection": {
    description: "Check ducts for leaks, debris, and airflow so the system can do its job.",
    points: ["Inspect the ducts", "Note leaks or debris", "Recommend next steps"],
    icon: Fan,
  },
  "System replacement estimates": {
    description: "Size a replacement system and write a comparable equipment estimate.",
    points: ["Size the system", "Compare equipment", "Write the estimate"],
    icon: Thermometer,
  },
  "AC installation": {
    description: "Install a new cooling system and confirm it holds temperature in every room.",
    points: ["Set the new unit", "Connect the lines", "Confirm cooling"],
    icon: Thermometer,
  },
  "Duct cleaning": {
    description: "Clear dust and debris from the ducts so air moves cleaner through the house.",
    points: ["Clear the ducts", "Check airflow", "Leave vents cleaner"],
    icon: Fan,
  },
  "Heat pump service": {
    description: "Service or repair a heat pump so it heats and cools on the same system.",
    points: ["Service the heat pump", "Check both modes", "Confirm set point"],
    icon: Thermometer,
  },
  "Safety inspections": {
    description: "Check panels, grounding, and devices and write up anything unsafe.",
    points: ["Inspect the panel", "Check grounding", "Write the findings"],
    icon: Shield,
  },
  "Ceiling fan installation": {
    description: "Hang a ceiling fan, wire the switch, and leave it balanced.",
    points: ["Mount the fan", "Wire the switch", "Balance the blades"],
    icon: Fan,
  },
  "Dedicated circuit install": {
    description: "Run a dedicated circuit for an appliance, shop tool, or home office.",
    points: ["Plan the run", "Install the circuit", "Label the breaker"],
    icon: Cable,
  },
  "Smoke detector install": {
    description: "Place and wire smoke or CO detectors where the house needs coverage.",
    points: ["Place the detectors", "Wire or mount them", "Test each unit"],
    icon: Shield,
  },
  "Hardware replacement": {
    description: "Swap worn knobs, hinges, and pulls so doors and cabinets work again.",
    points: ["Remove worn hardware", "Fit the new pieces", "Test the close"],
    icon: Hammer,
  },
  "Small drywall repair": {
    description: "Patch holes and cracks, then sand so the wall is ready to paint.",
    points: ["Fill the hole", "Sand it smooth", "Ready for paint"],
    icon: Square,
  },
  "Lock replacement": {
    description: "Replace a lockset or deadbolt and confirm the door latches cleanly.",
    points: ["Remove the old lock", "Fit the new set", "Test the latch"],
    icon: DoorOpen,
  },
  "Picture hanging": {
    description: "Hang frames and mirrors on studs or anchors so they sit level.",
    points: ["Find studs or anchors", "Hang the piece", "Level it"],
    icon: Hammer,
  },
  "Post-renovation cleaning": {
    description: "Clear dust and debris after a remodel so the rooms are ready to use.",
    points: ["Clear construction dust", "Wipe surfaces", "Ready to occupy"],
    icon: Sparkles,
  },
  "Add-on appliance cleaning": {
    description: "Deep-clean ovens, fridges, or other appliances added to the visit.",
    points: ["Clean the appliance", "Degrease interiors", "Leave it usable"],
    icon: SprayCan,
  },
  "Carpet cleaning": {
    description: "Extract dirt from carpets and leave them dry enough to walk on.",
    points: ["Pretreatment", "Extract the soil", "Set dry time"],
    icon: Sparkles,
  },
  "Window cleaning": {
    description: "Wash interior and exterior glass so the view is clear.",
    points: ["Wash the glass", "Wipe the sills", "Streak-free finish"],
    icon: Sparkles,
  },
  "Gutter coordination": {
    description: "Repair or align gutters so water leaves the roof and foundation.",
    points: ["Inspect the gutters", "Repair or realign", "Confirm the flow"],
    icon: House,
  },
  "Full roof replacement estimates": {
    description: "Measure the roof and write a replacement estimate with materials listed.",
    points: ["Measure the roof", "Specify materials", "Write the estimate"],
    icon: House,
  },
  "Gutter installation": {
    description: "Hang new gutters and downspouts so water sheds away from the house.",
    points: ["Hang the gutters", "Set downspouts", "Pitch for drainage"],
    icon: House,
  },
  "Roof flashing repair": {
    description: "Replace failed flashing at valleys, chimneys, or walls so leaks stop.",
    points: ["Find failed flashing", "Replace the metal", "Seal the joint"],
    icon: Droplets,
  },
  "Irrigation checks": {
    description: "Walk the sprinkler zones, find broken heads, and restore even coverage.",
    points: ["Walk the zones", "Fix broken heads", "Even coverage"],
    icon: Droplets,
  },
  "Yard improvement estimates": {
    description: "Walk the yard and write a scoped estimate for beds, sod, or hardscape.",
    points: ["Walk the property", "Scope the work", "Write the estimate"],
    icon: Trees,
  },
  "Tree trimming": {
    description: "Cut back limbs that hang on the house, walk, or power line path.",
    points: ["Cut back limbs", "Clear the house", "Haul the brush"],
    icon: Trees,
  },
  "Sod installation": {
    description: "Prep the soil and lay sod so the lawn is even and watered in.",
    points: ["Prep the soil", "Lay the sod", "Water it in"],
    icon: Leaf,
  },
  "Trim and door finishing": {
    description: "Sand and paint trim, doors, and casing for a consistent finish.",
    points: ["Prep the wood", "Paint the trim", "Even sheen"],
    icon: PaintRoller,
  },
  "Color consultation": {
    description: "Help pick colors and sheens, then write them into the paint scope.",
    points: ["Review the rooms", "Pick colors and sheen", "Lock the scope"],
    icon: PaintRoller,
  },
  "Deck staining": {
    description: "Clean, prep, and stain a deck so the wood is protected for the season.",
    points: ["Clean the deck", "Prep the wood", "Apply the stain"],
    icon: PaintRoller,
  },
  "Wallpaper removal": {
    description: "Strip wallpaper and skim the wall so it is ready for paint.",
    points: ["Strip the paper", "Skim the wall", "Ready for paint"],
    icon: Square,
  },
  "Accessibility improvements": {
    description: "Add grab bars, a taller toilet, or a lower threshold for safer use.",
    points: ["Plan the updates", "Install the hardware", "Safer access"],
    icon: Shield,
  },
  "Full bathroom remodels": {
    description: "Scope a full bath remodel with tile, fixtures, and a staged estimate.",
    points: ["Scope the room", "Stage the estimate", "Coordinate trades"],
    icon: ShowerHead,
  },
  "Shower door install": {
    description: "Measure and hang a shower door so it seals and swings cleanly.",
    points: ["Measure the opening", "Hang the door", "Confirm the seal"],
    icon: ShowerHead,
  },
  "Bathtub refinishing": {
    description: "Refinish a worn tub so the surface is smooth without a full tear-out.",
    points: ["Prep the tub", "Refinish the surface", "Cure time listed"],
    icon: Bath,
  },
  "Seasonal prevention plans": {
    description: "Set a recurring treatment so ants, wasps, and rodents stay out.",
    points: ["Inspect the property", "Set the schedule", "Treat on plan"],
    icon: Shield,
  },
  "Follow-up treatments": {
    description: "Return after the first visit to knock down what hatched or came back.",
    points: ["Check the first visit", "Treat remaining activity", "Update the plan"],
    icon: Bug,
  },
  "Bed bug treatment": {
    description: "Inspect, treat, and schedule follow-up for an active bed bug problem.",
    points: ["Inspect the rooms", "Treat hiding spots", "Schedule follow-up"],
    icon: Bug,
  },
  "Mosquito treatment": {
    description: "Treat yards and standing water so outdoor time is more usable.",
    points: ["Treat the yard", "Check standing water", "Note the re-treat window"],
    icon: Bug,
  },
};

export function getJobDetail(job: string) {
  return (
    jobDetails[job] ?? {
      description: "A typical job in this category. The written estimate lists the exact work.",
      points: ["Typical work in this category", "Written estimate after a visit", "Compare local pros"],
      icon: Wrench,
    }
  );
}

export function slugifyJob(job: string) {
  return job
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getJobPath(categorySlug: string, job: string) {
  return `/services/${categorySlug}/${slugifyJob(job)}`;
}

export function getAllJobs() {
  return serviceCategories.flatMap((category) =>
    category.commonServices.map((job, index) => ({
      category,
      job,
      index,
      slug: slugifyJob(job),
    }))
  );
}

export function getJobRecord(categorySlug: string, jobSlug: string) {
  const category = getServiceCategoryBySlug(categorySlug);
  if (!category) return undefined;

  const index = category.commonServices.findIndex((job) => slugifyJob(job) === jobSlug);
  if (index < 0) return undefined;

  const job = category.commonServices[index];
  return {
    category,
    job,
    index,
    slug: jobSlug,
    detail: getJobDetail(job),
  };
}

export function getRelatedJobs(category: ServiceCategory, job: string, limit = 4) {
  return category.commonServices.filter((item) => item !== job).slice(0, limit);
}

export type JobRecord = NonNullable<ReturnType<typeof getJobRecord>>;
