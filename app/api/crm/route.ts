import { guard, safeError } from "@/lib/auth";
import { db, list, save, create } from "@/lib/db";
import { saveSchema, createSchema } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(r: Request) {
  try {
    await guard(r);
    return Response.json({ rows: await list(db()) });
  } catch (e) {
    return Response.json({ error: safeError(e) }, { status: 400 });
  }
}
export async function PATCH(r: Request) {
  try {
    await guard(r);
    return Response.json({
      row: await save(db(), saveSchema.parse(await r.json())),
    });
  } catch (e) {
    return Response.json({ error: safeError(e) }, { status: 400 });
  }
}

export async function POST(r: Request) {
  try {
    await guard(r);
    const parsed = createSchema.safeParse(await r.json());
    if (!parsed.success)
      return Response.json(
        { error: "Check the message, source and enquiry fields." },
        { status: 400 },
      );
    return Response.json(
      { row: await create(db(), parsed.data) },
      { status: 201 },
    );
  } catch (e) {
    return Response.json({ error: safeError(e) }, { status: 400 });
  }
}
