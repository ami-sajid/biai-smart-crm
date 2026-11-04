import { z } from "zod";
import { guard, safeError } from "@/lib/auth";
import { db, reserve, setup, dayKey } from "@/lib/db";
import { analyze } from "@/lib/ai";
import { analysisSchema, pipelineContext, type Enquiry } from "@/lib/domain";
export const runtime = "nodejs";
export const maxDuration = 150;
export async function POST(r: Request) {
  try {
    await guard(r);
    const input = z
      .object({
        message: z.string().trim().min(1).max(15000),
        current: analysisSchema.optional(),
        enquiryId: z.number().int().positive().optional(),
      })
      .parse(await r.json());
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)
      throw Error("Add GEMINI_API_KEY and GEMINI_MODEL to enable AI.");
    let row: Enquiry | undefined;
    if (input.enquiryId) {
      row = (
        await db().query("SELECT data FROM biai_web_enquiries WHERE id=$1", [
          input.enquiryId,
        ])
      ).rows[0]?.data;
      if (!row) throw Error("Record not found.");
    }
    await setup(db());
    await reserve(
      db(),
      "ai:" + dayKey(),
      Math.max(0, Number(process.env.AI_DAILY_LIMIT ?? 40)),
    );
    return Response.json({
      analysis: await analyze(
        input.message,
        input.current,
        pipelineContext(row),
      ),
    });
  } catch (e) {
    return Response.json({ error: safeError(e) }, { status: 400 });
  }
}
