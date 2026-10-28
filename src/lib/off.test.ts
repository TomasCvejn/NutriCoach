import { afterEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/foods/route";
import { createUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { signIn, uniqueEmail } from "@/test/auth";
import { searchFoods } from "./food-search";
import { mapOffProduct, offProduct, searchOff, upsertOffFood } from "./off";

const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: request.cookie }) }));

// Every test mocks fetch: none touches the network.
afterEach(() => vi.restoreAllMocks());
const answer = (body: unknown, status = 200) => vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }));

const skyr = {
  code: "8594001231234",
  product_name: "Skyr natural",
  product_name_cs: "Skyr bílý",
  product_name_en: "Plain skyr",
  brands: "Mlékárna Kunín, Lidl",
  countries_tags: ["en:czech-republic", "en:slovakia"],
  serving_size: "1 kelímek (140 g)",
  serving_quantity: "140",
  nutriments: { "energy-kcal_100g": 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2, sodium_100g: 0.04, calcium_100g: 0.11, "vitamin-d_100g": 0.0000012, "vitamin-b12_100g": "" },
};

test("an OFF product maps to our food: per 100 g, minerals in mg, vitamin D in µg, missing values null", () => {
  expect(mapOffProduct(skyr, "cs")).toEqual({
    ...{ offCode: "8594001231234", name: "Skyr bílý", brand: "Mlékárna Kunín", czech: true, servings: [{ label: "1 kelímek (140 g)", grams: 140 }] },
    ...{ kcal: 63, protein: 11, carbs: 4, fat: 0.2, fiber: null, sugar: null, saturatedFat: null, sodium: 40, potassium: null, calcium: 110 },
    ...{ iron: null, magnesium: null, vitaminC: null, vitaminD: 1.2, vitaminB12: null },
  });
});

test("names: the viewer's language, then the other one, then OFF's default; kJ when kcal is missing; unusable products are skipped", () => {
  expect(mapOffProduct(skyr, "en")?.name).toBe("Plain skyr");
  expect(mapOffProduct({ ...skyr, product_name_en: undefined }, "en")?.name).toBe("Skyr bílý");
  expect(mapOffProduct({ ...skyr, product_name_cs: " ", product_name_en: undefined }, "cs")?.name).toBe("Skyr natural");
  expect(mapOffProduct({ ...skyr, nutriments: { ...skyr.nutriments, "energy-kcal_100g": undefined, energy_100g: 264 } }, "cs")?.kcal).toBe(63);
  expect(mapOffProduct({ ...skyr, product_name: undefined, product_name_cs: undefined, product_name_en: undefined }, "cs")).toBeNull();
  expect(mapOffProduct({ ...skyr, nutriments: { "energy-kcal_100g": 63, proteins_100g: 11 } }, "cs")).toBeNull();
  expect(mapOffProduct({ ...skyr, code: "../../etc" }, "cs")).toBeNull();
});

test("search asks OFF with our User-Agent and a timeout, and lists Czech products first", async () => {
  const fetch = answer({ products: [{ ...skyr, code: "4000000000001", countries_tags: ["en:germany"] }, skyr, { code: "1" }] });
  const found = await searchOff("skyr", "cs");
  expect(found.map((f) => f.offCode)).toEqual(["8594001231234", "4000000000001"]);
  const [url, init] = fetch.mock.calls[0];
  expect(String(url)).toMatch(/^https:\/\/world\.openfoodfacts\.org\/cgi\/search\.pl\?search_terms=skyr&/);
  expect(init).toMatchObject({ headers: { "User-Agent": "NutriCoach/0.1" }, signal: expect.any(AbortSignal) });

  answer({ status: 0, status_verbose: "product not found" });
  expect(await offProduct("8590000000000", "cs")).toBeNull();
  answer({}, 503);
  await expect(searchOff("skyr", "cs")).rejects.toThrow();
});

test("storing an OFF product is idempotent: one row per product code, refreshed on the next use", async () => {
  const food = mapOffProduct({ ...skyr, code: "8594009990001" }, "cs")!;
  const first = await upsertOffFood(food);
  const again = await upsertOffFood({ ...food, kcal: 65 });
  expect(again.id).toBe(first.id);
  expect(await db.food.findMany({ where: { offCode: "8594009990001" } })).toMatchObject([{ source: "OFF", ownerId: null, barcode: "8594009990001", kcal: 65 }]);
});

test("merged search: own foods, then stored OFF ones, then new OFF results; when OFF fails or times out, the local results and a notice", async () => {
  const coach = await createUser({ email: uniqueEmail("search-coach"), name: "Search Coach", role: "COACH" });
  const client = await createUser({ email: uniqueEmail("search-client"), name: "Client", role: "CLIENT", client: { create: { coachId: coach.id } } });
  await db.food.create({ data: { source: "COACH", ownerId: coach.id, name: "Skyr s granolou", kcal: 150, protein: 9, carbs: 18, fat: 4 } });
  const stored = await upsertOffFood(mapOffProduct({ ...skyr, code: "8594009990002", product_name_cs: "Skyr jahoda" }, "cs")!);
  const viewer = { role: "CLIENT", id: client.id, coachId: coach.id } as const;

  answer({ products: [{ ...skyr, code: "8594009990002" }, skyr] });
  const { results, offUnavailable } = await searchFoods(viewer, "Skyr", "cs");
  expect(offUnavailable).toBe(false);
  const mine = results.filter((r) => r.source !== "OFF" || r.id === stored.id || r.offCode === skyr.code);
  expect(mine.map((r) => [r.name, r.id === null])).toEqual([["Skyr s granolou", false], ["Skyr jahoda", false], ["Skyr bílý", true]]);

  vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
  const offline = await searchFoods(viewer, "Skyr", "cs");
  expect(offline.offUnavailable).toBe(true);
  expect(offline.results.map((r) => r.name)).toEqual(expect.arrayContaining(["Skyr s granolou", "Skyr jahoda"]));
  expect(offline.results.every((r) => r.id !== null)).toBe(true);
});

test("the search route answers only signed-in users and checks its parameters", async () => {
  const url = (query: string) => ({ nextUrl: new URL(`http://localhost/api/foods?${query}`) }) as Parameters<typeof GET>[0];
  request.cookie = "";
  expect((await GET(url("q=skyr"))).status).toBe(401);
  request.cookie = await signIn("sports@demo.cz");
  expect((await GET(url("q=s"))).status).toBe(400);
  expect((await GET(url("ean=12ab"))).status).toBe(400);
  answer({ status: 1, product: skyr });
  const res = await GET(url("ean=8594001231234"));
  expect(await res.json()).toMatchObject({ results: [{ id: null, offCode: "8594001231234", name: "Plain skyr" }], offUnavailable: false }); // sports@ reads English
  // A seeded custom food with this barcode would win; the client's own food matches by name.
  answer({ products: [] });
  expect(await (await GET(url("q=lactose"))).json()).toMatchObject({ results: [{ name: "Lactose-free skyr", source: "CLIENT" }], offUnavailable: false });
});
