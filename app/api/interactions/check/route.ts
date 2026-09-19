/** Retired: the product now checks medicine–food relationships. */
export async function POST() {
  return Response.json(
    {
      error: "Medicine-pair checks have been replaced by the food guide.",
      endpoint: "/api/food/check",
    },
    { status: 410 },
  );
}
