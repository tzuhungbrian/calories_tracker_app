import { GET as getFoods } from "../foods/route";

export const dynamic = "force-dynamic";

export async function GET() {
  return getFoods();
}
